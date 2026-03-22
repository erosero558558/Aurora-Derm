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
    const { defaultPolicy, policyExists = false } = options;
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

    const codexModelRouting = merged?.codex_model_routing;
    if (codexModelRouting !== undefined) {
        if (
            !codexModelRouting ||
            typeof codexModelRouting !== 'object' ||
            Array.isArray(codexModelRouting)
        ) {
            errors.push('codex_model_routing debe ser objeto');
        } else {
            for (const key of [
                'version',
                'scope',
                'default_model_tier',
                'premium_model_tier',
                'root_thread_model_tier',
                'premium_budget_unit',
                'ledger_path',
                'decision_packets_dir',
                'notes',
            ]) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        codexModelRouting,
                        key
                    ) &&
                    typeof codexModelRouting[key] !== 'string'
                ) {
                    errors.push(`codex_model_routing.${key} debe ser string`);
                }
            }
            for (const key of [
                'allowed_gate_states',
                'allowed_execution_modes',
                'premium_reasons',
                'prohibited_premium_uses',
                'decision_packet_fields',
                'fallback_order',
                'gate_open_conditions',
            ]) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        codexModelRouting,
                        key
                    ) &&
                    !Array.isArray(codexModelRouting[key])
                ) {
                    errors.push(`codex_model_routing.${key} debe ser array`);
                }
            }
            if (
                Object.prototype.hasOwnProperty.call(
                    codexModelRouting,
                    'target_mix'
                )
            ) {
                const targetMix = codexModelRouting.target_mix;
                if (
                    !targetMix ||
                    typeof targetMix !== 'object' ||
                    Array.isArray(targetMix)
                ) {
                    errors.push(
                        'codex_model_routing.target_mix debe ser objeto'
                    );
                } else {
                    for (const [name, rawValue] of Object.entries(targetMix)) {
                        const value = Number(rawValue);
                        if (!Number.isFinite(value) || value < 0) {
                            errors.push(
                                `codex_model_routing.target_mix.${name} invalido (${rawValue})`
                            );
                        }
                    }
                }
            }
            warnUnknownKeys(
                sourcePolicy?.codex_model_routing,
                [
                    'version',
                    'scope',
                    'default_model_tier',
                    'premium_model_tier',
                    'root_thread_model_tier',
                    'premium_budget_unit',
                    'ledger_path',
                    'decision_packets_dir',
                    'allowed_gate_states',
                    'allowed_execution_modes',
                    'premium_reasons',
                    'prohibited_premium_uses',
                    'decision_packet_fields',
                    'target_mix',
                    'fallback_order',
                    'gate_open_conditions',
                    'notes',
                ],
                'codex_model_routing'
            );
            warnUnknownKeys(
                sourcePolicy?.codex_model_routing?.target_mix,
                [
                    'zero_premium_pct',
                    'one_premium_pct',
                    'two_premium_pct',
                    'throughput_drop_guardrail_pct',
                ],
                'codex_model_routing.target_mix'
            );
        }
    }

    const agents = merged?.agents;
    if (agents !== undefined) {
        if (!agents || typeof agents !== 'object' || Array.isArray(agents)) {
            errors.push('agents debe ser objeto');
        } else {
            for (const key of ['active_executors', 'retired_executors']) {
                if (
                    Object.prototype.hasOwnProperty.call(agents, key) &&
                    !Array.isArray(agents[key])
                ) {
                    errors.push(`agents.${key} debe ser array`);
                }
            }
            if (
                Object.prototype.hasOwnProperty.call(
                    agents,
                    'allow_legacy_terminal_executors'
                ) &&
                typeof agents.allow_legacy_terminal_executors !== 'boolean'
            ) {
                errors.push(
                    'agents.allow_legacy_terminal_executors debe ser boolean'
                );
            }
            warnUnknownKeys(
                sourcePolicy?.agents,
                [
                    'active_executors',
                    'retired_executors',
                    'allow_legacy_terminal_executors',
                ],
                'agents'
            );
        }
    }

    const publishing = merged?.publishing;
    if (publishing !== undefined) {
        if (
            !publishing ||
            typeof publishing !== 'object' ||
            Array.isArray(publishing)
        ) {
            errors.push('publishing debe ser objeto');
        } else {
            if (
                Object.prototype.hasOwnProperty.call(publishing, 'enabled') &&
                typeof publishing.enabled !== 'boolean'
            ) {
                errors.push('publishing.enabled debe ser boolean');
            }
            for (const key of [
                'mode',
                'trigger',
                'branch',
                'gate_profile',
                'health_url',
                'required_job_key',
            ]) {
                if (
                    Object.prototype.hasOwnProperty.call(publishing, key) &&
                    typeof publishing[key] !== 'string'
                ) {
                    errors.push(`publishing.${key} debe ser string`);
                }
            }
            for (const key of [
                'checkpoint_cooldown_seconds',
                'max_live_wait_seconds',
            ]) {
                if (Object.prototype.hasOwnProperty.call(publishing, key)) {
                    const n = Number(publishing[key]);
                    if (!Number.isFinite(n) || n <= 0) {
                        errors.push(
                            `publishing.${key} invalido (${publishing[key]})`
                        );
                    }
                }
            }
            warnUnknownKeys(
                sourcePolicy?.publishing,
                [
                    'enabled',
                    'mode',
                    'trigger',
                    'branch',
                    'gate_profile',
                    'checkpoint_cooldown_seconds',
                    'max_live_wait_seconds',
                    'health_url',
                    'required_job_key',
                ],
                'publishing'
            );
        }
    }

    const runtime = merged?.runtime;
    if (runtime !== undefined) {
        if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
            errors.push('runtime debe ser objeto');
        } else {
            const providers = runtime.providers;
            const quotas = runtime.quotas;
            if (
                !providers ||
                typeof providers !== 'object' ||
                Array.isArray(providers)
            ) {
                errors.push('runtime.providers debe ser objeto');
            } else {
                for (const [providerName, providerCfg] of Object.entries(
                    providers
                )) {
                    if (
                        !providerCfg ||
                        typeof providerCfg !== 'object' ||
                        Array.isArray(providerCfg)
                    ) {
                        errors.push(
                            `runtime.providers.${providerName} debe ser objeto`
                        );
                        continue;
                    }
                    for (const key of [
                        'default_transport',
                        'preferred_transport',
                    ]) {
                        if (
                            Object.prototype.hasOwnProperty.call(
                                providerCfg,
                                key
                            ) &&
                            typeof providerCfg[key] !== 'string'
                        ) {
                            errors.push(
                                `runtime.providers.${providerName}.${key} debe ser string`
                            );
                        }
                    }
                    for (const key of ['surfaces', 'transports']) {
                        if (
                            Object.prototype.hasOwnProperty.call(
                                providerCfg,
                                key
                            ) &&
                            (!providerCfg[key] ||
                                typeof providerCfg[key] !== 'object' ||
                                Array.isArray(providerCfg[key]))
                        ) {
                            errors.push(
                                `runtime.providers.${providerName}.${key} debe ser objeto`
                            );
                        }
                    }
                    warnUnknownKeys(
                        sourcePolicy?.runtime?.providers?.[providerName],
                        [
                            'default_transport',
                            'preferred_transport',
                            'surfaces',
                            'transports',
                        ],
                        `runtime.providers.${providerName}`
                    );
                }
            }
            if (
                quotas !== undefined &&
                (!quotas || typeof quotas !== 'object' || Array.isArray(quotas))
            ) {
                errors.push('runtime.quotas debe ser objeto');
            } else if (
                quotas &&
                typeof quotas === 'object' &&
                !Array.isArray(quotas)
            ) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        quotas,
                        'by_codex_instance'
                    )
                ) {
                    const byCodexInstance = quotas.by_codex_instance;
                    if (
                        !byCodexInstance ||
                        typeof byCodexInstance !== 'object' ||
                        Array.isArray(byCodexInstance)
                    ) {
                        errors.push(
                            'runtime.quotas.by_codex_instance debe ser objeto'
                        );
                    } else {
                        for (const [instance, rawLimit] of Object.entries(
                            byCodexInstance
                        )) {
                            const limit = Number(rawLimit);
                            if (!Number.isFinite(limit) || limit <= 0) {
                                errors.push(
                                    `runtime.quotas.by_codex_instance.${instance} invalido (${rawLimit})`
                                );
                            }
                        }
                    }
                }
                warnUnknownKeys(
                    sourcePolicy?.runtime?.quotas,
                    ['by_codex_instance'],
                    'runtime.quotas'
                );
            }
            warnUnknownKeys(
                sourcePolicy?.runtime,
                ['providers', 'quotas'],
                'runtime'
            );
        }
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
            const boardLeases = enforcement.board_leases;
            const boardDoctor = enforcement.board_doctor;
            const wipLimits = enforcement.wip_limits;
            const codexParallelism = enforcement.codex_parallelism;
            const workspaceSync = enforcement.workspace_sync;
            const workspaceHygiene = enforcement.workspace_hygiene;
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
            if (
                workspaceSync !== undefined &&
                (!workspaceSync ||
                    typeof workspaceSync !== 'object' ||
                    Array.isArray(workspaceSync))
            ) {
                errors.push('enforcement.workspace_sync debe ser objeto');
            } else if (
                workspaceSync &&
                typeof workspaceSync === 'object' &&
                !Array.isArray(workspaceSync)
            ) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        workspaceSync,
                        'enabled'
                    ) &&
                    typeof workspaceSync.enabled !== 'boolean'
                ) {
                    errors.push(
                        'enforcement.workspace_sync.enabled debe ser boolean'
                    );
                }
                for (const key of ['ttl_minutes', 'watcher_interval_seconds']) {
                    if (Object.prototype.hasOwnProperty.call(workspaceSync, key)) {
                        const n = Number(workspaceSync[key]);
                        if (!Number.isFinite(n) || n <= 0) {
                            errors.push(
                                `enforcement.workspace_sync.${key} invalido (${workspaceSync[key]})`
                            );
                        }
                    }
                }
                for (const key of [
                    'remote',
                    'root_branch',
                    'task_branch_prefix',
                    'local_dir',
                    'worktrees_dir',
                    'machine_id_filename',
                    'sync_status_filename',
                    'watcher_task_name',
                    'watcher_script_path',
                ]) {
                    if (
                        Object.prototype.hasOwnProperty.call(workspaceSync, key) &&
                        typeof workspaceSync[key] !== 'string'
                    ) {
                        errors.push(
                            `enforcement.workspace_sync.${key} debe ser string`
                        );
                    }
                }
                warnUnknownKeys(
                    sourcePolicy?.enforcement?.workspace_sync,
                    [
                        'enabled',
                        'ttl_minutes',
                        'watcher_interval_seconds',
                        'remote',
                        'root_branch',
                        'task_branch_prefix',
                        'local_dir',
                        'worktrees_dir',
                        'machine_id_filename',
                        'sync_status_filename',
                        'watcher_task_name',
                        'watcher_script_path',
                    ],
                    'enforcement.workspace_sync'
                );
            }
            if (
                workspaceHygiene !== undefined &&
                (!workspaceHygiene ||
                    typeof workspaceHygiene !== 'object' ||
                    Array.isArray(workspaceHygiene))
            ) {
                errors.push('enforcement.workspace_hygiene debe ser objeto');
            } else if (
                workspaceHygiene &&
                typeof workspaceHygiene === 'object' &&
                !Array.isArray(workspaceHygiene)
            ) {
                for (const key of ['enabled', 'allow_unavailable']) {
                    if (
                        Object.prototype.hasOwnProperty.call(
                            workspaceHygiene,
                            key
                        ) &&
                        typeof workspaceHygiene[key] !== 'boolean'
                    ) {
                        errors.push(
                            `enforcement.workspace_hygiene.${key} debe ser boolean`
                        );
                    }
                }
                for (const key of ['default_scope', 'mutation_scope']) {
                    if (
                        Object.prototype.hasOwnProperty.call(
                            workspaceHygiene,
                            key
                        ) &&
                        !['all-worktrees', 'current-only'].includes(
                            String(workspaceHygiene[key] || '').trim()
                        )
                    ) {
                        errors.push(
                            `enforcement.workspace_hygiene.${key} invalido (${workspaceHygiene[key]})`
                        );
                    }
                }
                if (
                    Object.prototype.hasOwnProperty.call(
                        workspaceHygiene,
                        'block_states'
                    )
                ) {
                    if (!Array.isArray(workspaceHygiene.block_states)) {
                        errors.push(
                            'enforcement.workspace_hygiene.block_states debe ser array'
                        );
                    } else if (workspaceHygiene.block_states.length === 0) {
                        errors.push(
                            'enforcement.workspace_hygiene.block_states no puede ser vacio'
                        );
                    }
                }
                warnUnknownKeys(
                    sourcePolicy?.enforcement?.workspace_hygiene,
                    [
                        'enabled',
                        'default_scope',
                        'mutation_scope',
                        'block_states',
                        'allow_unavailable',
                    ],
                    'enforcement.workspace_hygiene'
                );
            }
            if (
                boardLeases !== undefined &&
                (!boardLeases ||
                    typeof boardLeases !== 'object' ||
                    Array.isArray(boardLeases))
            ) {
                errors.push('enforcement.board_leases debe ser objeto');
            } else if (
                boardLeases &&
                typeof boardLeases === 'object' &&
                !Array.isArray(boardLeases)
            ) {
                for (const key of ['enabled', 'auto_clear_on_terminal']) {
                    if (
                        Object.prototype.hasOwnProperty.call(
                            boardLeases,
                            key
                        ) &&
                        typeof boardLeases[key] !== 'boolean'
                    ) {
                        errors.push(
                            `enforcement.board_leases.${key} debe ser boolean`
                        );
                    }
                }
                for (const key of [
                    'ttl_hours_default',
                    'ttl_hours_max',
                    'heartbeat_stale_minutes',
                ]) {
                    if (
                        Object.prototype.hasOwnProperty.call(boardLeases, key)
                    ) {
                        const n = Number(boardLeases[key]);
                        if (!Number.isFinite(n) || n <= 0) {
                            errors.push(
                                `enforcement.board_leases.${key} invalido (${boardLeases[key]})`
                            );
                        }
                    }
                }
                for (const key of ['required_statuses', 'tracked_statuses']) {
                    if (
                        Object.prototype.hasOwnProperty.call(boardLeases, key)
                    ) {
                        if (!Array.isArray(boardLeases[key])) {
                            errors.push(
                                `enforcement.board_leases.${key} debe ser array`
                            );
                        } else if (boardLeases[key].length === 0) {
                            errors.push(
                                `enforcement.board_leases.${key} no puede ser vacio`
                            );
                        }
                    }
                }
                warnUnknownKeys(
                    sourcePolicy?.enforcement?.board_leases,
                    [
                        'enabled',
                        'required_statuses',
                        'tracked_statuses',
                        'ttl_hours_default',
                        'ttl_hours_max',
                        'heartbeat_stale_minutes',
                        'auto_clear_on_terminal',
                    ],
                    'enforcement.board_leases'
                );
            }
            if (
                boardDoctor !== undefined &&
                (!boardDoctor ||
                    typeof boardDoctor !== 'object' ||
                    Array.isArray(boardDoctor))
            ) {
                errors.push('enforcement.board_doctor debe ser objeto');
            } else if (
                boardDoctor &&
                typeof boardDoctor === 'object' &&
                !Array.isArray(boardDoctor)
            ) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        boardDoctor,
                        'enabled'
                    ) &&
                    typeof boardDoctor.enabled !== 'boolean'
                ) {
                    errors.push(
                        'enforcement.board_doctor.enabled debe ser boolean'
                    );
                }
                if (
                    Object.prototype.hasOwnProperty.call(
                        boardDoctor,
                        'strict_default'
                    ) &&
                    typeof boardDoctor.strict_default !== 'boolean'
                ) {
                    errors.push(
                        'enforcement.board_doctor.strict_default debe ser boolean'
                    );
                }
                if (
                    Object.prototype.hasOwnProperty.call(
                        boardDoctor,
                        'thresholds'
                    )
                ) {
                    if (
                        !boardDoctor.thresholds ||
                        typeof boardDoctor.thresholds !== 'object' ||
                        Array.isArray(boardDoctor.thresholds)
                    ) {
                        errors.push(
                            'enforcement.board_doctor.thresholds debe ser objeto'
                        );
                    } else {
                        for (const [k, v] of Object.entries(
                            boardDoctor.thresholds
                        )) {
                            const n = Number(v);
                            if (!Number.isFinite(n) || n < 0) {
                                errors.push(
                                    `enforcement.board_doctor.thresholds.${k} invalido (${v})`
                                );
                            }
                        }
                    }
                }
                warnUnknownKeys(
                    sourcePolicy?.enforcement?.board_doctor,
                    ['enabled', 'strict_default', 'thresholds'],
                    'enforcement.board_doctor'
                );
                warnUnknownKeys(
                    sourcePolicy?.enforcement?.board_doctor?.thresholds,
                    [
                        'in_progress_stale_hours',
                        'blocked_stale_hours',
                        'review_stale_hours',
                        'done_without_evidence_max_hours',
                    ],
                    'enforcement.board_doctor.thresholds'
                );
            }
            if (
                wipLimits !== undefined &&
                (!wipLimits ||
                    typeof wipLimits !== 'object' ||
                    Array.isArray(wipLimits))
            ) {
                errors.push('enforcement.wip_limits debe ser objeto');
            } else if (
                wipLimits &&
                typeof wipLimits === 'object' &&
                !Array.isArray(wipLimits)
            ) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        wipLimits,
                        'enabled'
                    ) &&
                    typeof wipLimits.enabled !== 'boolean'
                ) {
                    errors.push(
                        'enforcement.wip_limits.enabled debe ser boolean'
                    );
                }
                if (
                    Object.prototype.hasOwnProperty.call(wipLimits, 'mode') &&
                    !['warn', 'error', 'ignore'].includes(
                        String(wipLimits.mode || '').trim()
                    )
                ) {
                    errors.push(
                        `enforcement.wip_limits.mode invalido (${wipLimits.mode})`
                    );
                }
                if (
                    Object.prototype.hasOwnProperty.call(
                        wipLimits,
                        'count_statuses'
                    ) &&
                    !Array.isArray(wipLimits.count_statuses)
                ) {
                    errors.push(
                        'enforcement.wip_limits.count_statuses debe ser array'
                    );
                }
                for (const key of ['by_executor', 'by_scope']) {
                    if (Object.prototype.hasOwnProperty.call(wipLimits, key)) {
                        const value = wipLimits[key];
                        if (
                            !value ||
                            typeof value !== 'object' ||
                            Array.isArray(value)
                        ) {
                            errors.push(
                                `enforcement.wip_limits.${key} debe ser objeto`
                            );
                            continue;
                        }
                        for (const [name, rawLimit] of Object.entries(value)) {
                            const n = Number(rawLimit);
                            if (!Number.isFinite(n) || n <= 0) {
                                errors.push(
                                    `enforcement.wip_limits.${key}.${name} invalido (${rawLimit})`
                                );
                            }
                        }
                    }
                }
                warnUnknownKeys(
                    sourcePolicy?.enforcement?.wip_limits,
                    [
                        'enabled',
                        'mode',
                        'count_statuses',
                        'by_executor',
                        'by_scope',
                    ],
                    'enforcement.wip_limits'
                );
            }
            if (
                codexParallelism !== undefined &&
                (!codexParallelism ||
                    typeof codexParallelism !== 'object' ||
                    Array.isArray(codexParallelism))
            ) {
                errors.push('enforcement.codex_parallelism debe ser objeto');
            } else if (
                codexParallelism &&
                typeof codexParallelism === 'object' &&
                !Array.isArray(codexParallelism)
            ) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        codexParallelism,
                        'slot_statuses'
                    )
                ) {
                    if (!Array.isArray(codexParallelism.slot_statuses)) {
                        errors.push(
                            'enforcement.codex_parallelism.slot_statuses debe ser array'
                        );
                    } else if (codexParallelism.slot_statuses.length === 0) {
                        errors.push(
                            'enforcement.codex_parallelism.slot_statuses no puede ser vacio'
                        );
                    }
                }
                if (
                    Object.prototype.hasOwnProperty.call(
                        codexParallelism,
                        'by_codex_instance'
                    )
                ) {
                    const value = codexParallelism.by_codex_instance;
                    if (
                        !value ||
                        typeof value !== 'object' ||
                        Array.isArray(value)
                    ) {
                        errors.push(
                            'enforcement.codex_parallelism.by_codex_instance debe ser objeto'
                        );
                    } else {
                        for (const [name, rawLimit] of Object.entries(value)) {
                            const n = Number(rawLimit);
                            if (!Number.isFinite(n) || n <= 0) {
                                errors.push(
                                    `enforcement.codex_parallelism.by_codex_instance.${name} invalido (${rawLimit})`
                                );
                            }
                        }
                    }
                }
                warnUnknownKeys(
                    sourcePolicy?.enforcement?.codex_parallelism,
                    ['slot_statuses', 'by_codex_instance'],
                    'enforcement.codex_parallelism'
                );
            }
            warnUnknownKeys(
                sourcePolicy?.enforcement,
                [
                    'branch_profiles',
                    'warning_policies',
                    'board_leases',
                    'board_doctor',
                    'wip_limits',
                    'codex_parallelism',
                    'workspace_sync',
                    'workspace_hygiene',
                ],
                'enforcement'
            );
        }
    }

    warnUnknownKeys(
        sourcePolicy,
        [
            'version',
            'domain_health',
            'summary',
            'codex_model_routing',
            'agents',
            'publishing',
            'runtime',
            'enforcement',
        ],
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
            codex_model_routing:
                codexModelRouting &&
                typeof codexModelRouting === 'object' &&
                !Array.isArray(codexModelRouting)
                    ? codexModelRouting
                    : {},
            agents: {
                active_executors: Array.isArray(agents?.active_executors)
                    ? agents.active_executors.map((value) => String(value))
                    : [],
                retired_executors: Array.isArray(agents?.retired_executors)
                    ? agents.retired_executors.map((value) => String(value))
                    : [],
                allow_legacy_terminal_executors:
                    typeof agents?.allow_legacy_terminal_executors === 'boolean'
                        ? agents.allow_legacy_terminal_executors
                        : null,
            },
            publishing: {
                enabled:
                    typeof publishing?.enabled === 'boolean'
                        ? publishing.enabled
                        : null,
                mode:
                    typeof publishing?.mode === 'string' ? publishing.mode : '',
                trigger:
                    typeof publishing?.trigger === 'string'
                        ? publishing.trigger
                        : '',
                branch:
                    typeof publishing?.branch === 'string'
                        ? publishing.branch
                        : '',
                gate_profile:
                    typeof publishing?.gate_profile === 'string'
                        ? publishing.gate_profile
                        : '',
                checkpoint_cooldown_seconds: Number.isFinite(
                    Number(publishing?.checkpoint_cooldown_seconds)
                )
                    ? Number(publishing.checkpoint_cooldown_seconds)
                    : null,
                max_live_wait_seconds: Number.isFinite(
                    Number(publishing?.max_live_wait_seconds)
                )
                    ? Number(publishing.max_live_wait_seconds)
                    : null,
                health_url:
                    typeof publishing?.health_url === 'string'
                        ? publishing.health_url
                        : '',
                required_job_key:
                    typeof publishing?.required_job_key === 'string'
                        ? publishing.required_job_key
                        : '',
            },
            runtime:
                runtime &&
                typeof runtime === 'object' &&
                !Array.isArray(runtime)
                    ? runtime
                    : {
                          providers: {},
                          quotas: {},
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
                          board_leases:
                              enforcement.board_leases &&
                              typeof enforcement.board_leases === 'object' &&
                              !Array.isArray(enforcement.board_leases)
                                  ? enforcement.board_leases
                                  : {},
                          board_doctor:
                              enforcement.board_doctor &&
                              typeof enforcement.board_doctor === 'object' &&
                              !Array.isArray(enforcement.board_doctor)
                                  ? enforcement.board_doctor
                                  : {},
                          wip_limits:
                              enforcement.wip_limits &&
                              typeof enforcement.wip_limits === 'object' &&
                              !Array.isArray(enforcement.wip_limits)
                                  ? enforcement.wip_limits
                                  : {},
                          workspace_sync:
                              enforcement.workspace_sync &&
                              typeof enforcement.workspace_sync === 'object' &&
                              !Array.isArray(enforcement.workspace_sync)
                                  ? enforcement.workspace_sync
                                  : {},
                          workspace_hygiene:
                              enforcement.workspace_hygiene &&
                              typeof enforcement.workspace_hygiene ===
                                  'object' &&
                              !Array.isArray(enforcement.workspace_hygiene)
                                  ? enforcement.workspace_hygiene
                                  : {},
                          codex_parallelism:
                              enforcement.codex_parallelism &&
                              typeof enforcement.codex_parallelism ===
                                  'object' &&
                              !Array.isArray(enforcement.codex_parallelism)
                                  ? enforcement.codex_parallelism
                                  : {},
                      }
                    : {
                          branch_profiles: {},
                          warning_policies: {},
                          board_leases: {},
                          board_doctor: {},
                          wip_limits: {},
                          workspace_sync: {},
                          workspace_hygiene: {},
                          codex_parallelism: {},
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
