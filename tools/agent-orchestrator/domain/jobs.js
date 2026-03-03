'use strict';

function parseIsoMillis(value) {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function computeAgeSeconds(value, nowMs = Date.now()) {
    const parsed = parseIsoMillis(value);
    if (!Number.isFinite(parsed)) return null;
    const ageSeconds = Math.max(0, Math.floor((nowMs - parsed) / 1000));
    return Number.isFinite(ageSeconds) ? ageSeconds : null;
}

function normalizeRegistryJob(job = {}) {
    return {
        key: String(job.key || '').trim(),
        job_id: String(job.job_id || '').trim(),
        enabled: job.enabled !== false,
        type: String(job.type || 'external_cron').trim() || 'external_cron',
        owner: String(job.owner || 'codex_backend_ops').trim() || 'codex_backend_ops',
        environment: String(job.environment || 'production').trim() || 'production',
        repo_path: String(job.repo_path || '').trim(),
        branch: String(job.branch || 'main').trim() || 'main',
        schedule: String(job.schedule || '').trim(),
        command: String(job.command || '').trim(),
        wrapper_fallback: String(job.wrapper_fallback || '').trim(),
        lock_file: String(job.lock_file || '').trim(),
        log_path: String(job.log_path || '').trim(),
        status_path: String(job.status_path || '').trim(),
        health_url: String(job.health_url || '').trim(),
        expected_max_lag_seconds: Number.parseInt(
            String(job.expected_max_lag_seconds || '0'),
            10
        ) || 0,
        source_of_truth: String(job.source_of_truth || 'host_cron').trim() || 'host_cron',
        publish_strategy: String(job.publish_strategy || 'main_auto_guarded').trim() || 'main_auto_guarded',
    };
}

function normalizeSnapshotFromFile(job, payload = {}, nowMs = Date.now()) {
    const checkedAt =
        String(payload.checked_at || '').trim() ||
        String(payload.finished_at || '').trim() ||
        String(payload.last_success_at || '').trim() ||
        String(payload.started_at || '').trim();
    const ageSeconds = computeAgeSeconds(checkedAt, nowMs);
    const state = String(payload.state || 'unknown').trim() || 'unknown';
    const healthy =
        state !== 'failed' &&
        ageSeconds !== null &&
        ageSeconds <= Number(job.expected_max_lag_seconds || 0);

    return {
        key: job.key,
        job_id: String(payload.job_id || job.job_id || '').trim(),
        enabled: job.enabled,
        type: job.type,
        source_of_truth: job.source_of_truth,
        verification_source: 'local_status_file',
        verified: true,
        configured: true,
        healthy,
        state,
        age_seconds: ageSeconds,
        expected_max_lag_seconds: Number(job.expected_max_lag_seconds || 0),
        deployed_commit: String(
            payload.deployed_commit || payload.remote_head || ''
        ).trim(),
        checked_at: checkedAt,
        last_success_at: String(payload.last_success_at || '').trim(),
        last_error_at: String(payload.last_error_at || '').trim(),
        last_error_message: String(payload.last_error_message || '').trim(),
        details: payload,
    };
}

function normalizeSnapshotFromHealth(job, payload = {}) {
    const ageSecondsRaw = Number.parseInt(
        String(payload.ageSeconds ?? payload.age_seconds ?? ''),
        10
    );
    const ageSeconds = Number.isFinite(ageSecondsRaw) ? ageSecondsRaw : null;
    return {
        key: job.key,
        job_id: String(payload.jobId || payload.job_id || job.job_id || '').trim(),
        enabled: job.enabled,
        type: job.type,
        source_of_truth: job.source_of_truth,
        verification_source: 'health_url',
        verified: true,
        configured:
            payload.configured !== undefined
                ? Boolean(payload.configured)
                : true,
        healthy: Boolean(payload.healthy),
        state: String(payload.state || 'unknown').trim() || 'unknown',
        age_seconds: ageSeconds,
        expected_max_lag_seconds: Number.parseInt(
            String(
                payload.expectedMaxLagSeconds ||
                    payload.expected_max_lag_seconds ||
                    job.expected_max_lag_seconds ||
                    '0'
            ),
            10
        ) || 0,
        deployed_commit: String(
            payload.deployedCommit || payload.deployed_commit || ''
        ).trim(),
        checked_at: String(
            payload.lastCheckedAt || payload.checked_at || ''
        ).trim(),
        last_success_at: String(
            payload.lastSuccessAt || payload.last_success_at || ''
        ).trim(),
        last_error_at: String(
            payload.lastErrorAt || payload.last_error_at || ''
        ).trim(),
        last_error_message: String(
            payload.lastErrorMessage || payload.last_error_message || ''
        ).trim(),
        details: payload,
    };
}

async function resolveJobSnapshot(jobRaw, deps = {}) {
    const job = normalizeRegistryJob(jobRaw);
    const {
        existsSync = () => false,
        readFileSync = () => '',
        fetchImpl = typeof fetch === 'function' ? fetch : null,
    } = deps;

    if (job.status_path && existsSync(job.status_path)) {
        try {
            const raw = String(readFileSync(job.status_path, 'utf8') || '');
            const payload = JSON.parse(raw);
            return normalizeSnapshotFromFile(job, payload);
        } catch (error) {
            return {
                key: job.key,
                job_id: job.job_id,
                enabled: job.enabled,
                type: job.type,
                source_of_truth: job.source_of_truth,
                verification_source: 'local_status_file',
                verified: false,
                configured: true,
                healthy: false,
                state: 'failed',
                age_seconds: null,
                expected_max_lag_seconds: job.expected_max_lag_seconds,
                deployed_commit: '',
                checked_at: '',
                last_success_at: '',
                last_error_at: '',
                last_error_message: `status_read_failed: ${error.message}`,
                details: null,
            };
        }
    }

    if (job.health_url && typeof fetchImpl === 'function') {
        try {
            const response = await fetchImpl(job.health_url, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'pielarmonia-agent-orchestrator/1.0',
                    'Cache-Control': 'no-cache',
                },
            });
            if (response && response.ok) {
                const payload = await response.json();
                const publicSync = payload?.checks?.publicSync || null;
                if (publicSync && typeof publicSync === 'object') {
                    return normalizeSnapshotFromHealth(job, publicSync);
                }
            }
        } catch {
            // Fall through to registry-only mode.
        }
    }

    return {
        key: job.key,
        job_id: job.job_id,
        enabled: job.enabled,
        type: job.type,
        source_of_truth: job.source_of_truth,
        verification_source: 'registry_only',
        verified: false,
        configured: true,
        healthy: false,
        state: 'unknown',
        age_seconds: null,
        expected_max_lag_seconds: job.expected_max_lag_seconds,
        deployed_commit: '',
        checked_at: '',
        last_success_at: '',
        last_error_at: '',
        last_error_message: '',
        details: null,
    };
}

async function buildJobsSnapshot(registry = {}, deps = {}) {
    const jobs = Array.isArray(registry.jobs) ? registry.jobs : [];
    const snapshots = [];
    for (const job of jobs) {
        snapshots.push(await resolveJobSnapshot(job, deps));
    }
    return snapshots;
}

function summarizeJobsSnapshot(jobs = []) {
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const healthyJobs = safeJobs.filter((job) => job.healthy);
    const failingJobs = safeJobs.filter(
        (job) => job.enabled && (!job.verified || !job.healthy)
    );
    const summary = {
        tracked: safeJobs.length,
        healthy: healthyJobs.length,
        failing: failingJobs.length,
    };

    for (const job of safeJobs) {
        summary[job.key] = {
            healthy: Boolean(job.healthy),
            age_seconds:
                job.age_seconds === null || job.age_seconds === undefined
                    ? null
                    : Number(job.age_seconds),
            deployed_commit: String(job.deployed_commit || ''),
        };
    }

    return summary;
}

function findJobSnapshot(jobs = [], key = '') {
    const target = String(key || '').trim();
    return (Array.isArray(jobs) ? jobs : []).find(
        (job) => String(job.key || '') === target
    );
}

module.exports = {
    normalizeRegistryJob,
    normalizeSnapshotFromFile,
    normalizeSnapshotFromHealth,
    resolveJobSnapshot,
    buildJobsSnapshot,
    summarizeJobsSnapshot,
    findJobSnapshot,
    parseIsoMillis,
    computeAgeSeconds,
};
