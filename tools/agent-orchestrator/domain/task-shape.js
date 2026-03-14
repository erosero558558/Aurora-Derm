'use strict';

function toTaskJson(task) {
    return {
        id: String(task?.id || ''),
        title: String(task?.title || ''),
        owner: String(task?.owner || ''),
        executor: String(task?.executor || ''),
        status: String(task?.status || ''),
        risk: String(task?.risk || ''),
        scope: String(task?.scope || ''),
        codex_instance: String(task?.codex_instance || ''),
        domain_lane: String(task?.domain_lane || ''),
        lane_lock: String(task?.lane_lock || ''),
        cross_domain: Boolean(task?.cross_domain),
        provider_mode: String(task?.provider_mode || ''),
        runtime_surface: String(task?.runtime_surface || ''),
        runtime_transport: String(task?.runtime_transport || ''),
        runtime_last_transport: String(task?.runtime_last_transport || ''),
        strategy_id: String(task?.strategy_id || ''),
        subfront_id: String(task?.subfront_id || ''),
        strategy_role: String(task?.strategy_role || ''),
        strategy_reason: String(task?.strategy_reason || ''),
        files: Array.isArray(task?.files) ? task.files : [],
        acceptance_ref: String(task?.acceptance_ref || ''),
        updated_at: String(task?.updated_at || ''),
    };
}

function toTaskFullJson(task) {
    return {
        id: String(task?.id || ''),
        title: String(task?.title || ''),
        owner: String(task?.owner || ''),
        executor: String(task?.executor || ''),
        status: String(task?.status || ''),
        risk: String(task?.risk || ''),
        scope: String(task?.scope || ''),
        codex_instance: String(task?.codex_instance || ''),
        domain_lane: String(task?.domain_lane || ''),
        lane_lock: String(task?.lane_lock || ''),
        cross_domain: Boolean(task?.cross_domain),
        provider_mode: String(task?.provider_mode || ''),
        runtime_surface: String(task?.runtime_surface || ''),
        runtime_transport: String(task?.runtime_transport || ''),
        runtime_last_transport: String(task?.runtime_last_transport || ''),
        strategy_id: String(task?.strategy_id || ''),
        subfront_id: String(task?.subfront_id || ''),
        strategy_role: String(task?.strategy_role || ''),
        strategy_reason: String(task?.strategy_reason || ''),
        files: Array.isArray(task?.files) ? task.files : [],
        acceptance: String(task?.acceptance || ''),
        acceptance_ref: String(task?.acceptance_ref || ''),
        depends_on: Array.isArray(task?.depends_on) ? task.depends_on : [],
        prompt: String(task?.prompt || ''),
        created_at: String(task?.created_at || ''),
        updated_at: String(task?.updated_at || ''),
    };
}

module.exports = {
    toTaskJson,
    toTaskFullJson,
};
