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

function parseOptionalInteger(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function computeHeadDrift(currentHead, remoteHead) {
    const current = String(currentHead || '').trim();
    const remote = String(remoteHead || '').trim();
    return Boolean(current && remote && current !== remote);
}

function computeTelemetryGap(snapshot = {}) {
    const healthy = Boolean(snapshot.healthy);
    const lastErrorMessage = String(
        snapshot.last_error_message || snapshot.lastErrorMessage || ''
    ).trim();
    const currentHead = String(
        snapshot.current_head || snapshot.currentHead || ''
    ).trim();
    const remoteHead = String(
        snapshot.remote_head || snapshot.remoteHead || ''
    ).trim();
    const dirtyPathsCount =
        parseOptionalInteger(
            snapshot.dirty_paths_count ?? snapshot.dirtyPathsCount
        ) ?? 0;
    const dirtyPathsSample = normalizeStringArray(
        snapshot.dirty_paths_sample ?? snapshot.dirtyPathsSample
    );
    const dirtyPaths = normalizeStringArray(
        snapshot.dirty_paths ?? snapshot.dirtyPaths
    );

    return (
        !healthy &&
        Boolean(lastErrorMessage) &&
        !currentHead &&
        !remoteHead &&
        dirtyPathsCount <= 0 &&
        dirtyPathsSample.length === 0 &&
        dirtyPaths.length === 0
    );
}

function computeFailureReason(snapshot = {}) {
    if (snapshot.configured === false) return 'unconfigured';

    const ageSeconds = parseOptionalInteger(
        snapshot.age_seconds ?? snapshot.ageSeconds
    );
    const expectedMaxLagSeconds =
        parseOptionalInteger(
            snapshot.expected_max_lag_seconds ?? snapshot.expectedMaxLagSeconds
        ) ?? 0;
    if (
        ageSeconds !== null &&
        expectedMaxLagSeconds > 0 &&
        ageSeconds > expectedMaxLagSeconds
    ) {
        return 'stale';
    }

    const lastErrorMessage = String(
        snapshot.last_error_message || snapshot.lastErrorMessage || ''
    ).trim();
    if (lastErrorMessage) return lastErrorMessage;

    if (snapshot.verified === false) return 'unverified';

    const state = String(snapshot.state || '').trim();
    if (state === 'failed') return 'failed';
    if (!snapshot.healthy) return 'unhealthy';
    return '';
}

function normalizeRegistryJob(job = {}) {
    return {
        key: String(job.key || '').trim(),
        job_id: String(job.job_id || '').trim(),
        enabled: job.enabled !== false,
        type: String(job.type || 'external_cron').trim() || 'external_cron',
        owner:
            String(job.owner || 'codex_backend_ops').trim() ||
            'codex_backend_ops',
        environment:
            String(job.environment || 'production').trim() || 'production',
        repo_path: String(job.repo_path || '').trim(),
        branch: String(job.branch || 'main').trim() || 'main',
        schedule: String(job.schedule || '').trim(),
        command: String(job.command || '').trim(),
        wrapper_fallback: String(job.wrapper_fallback || '').trim(),
        lock_file: String(job.lock_file || '').trim(),
        log_path: String(job.log_path || '').trim(),
        status_path: String(job.status_path || '').trim(),
        health_url: String(job.health_url || '').trim(),
        expected_max_lag_seconds:
            Number.parseInt(String(job.expected_max_lag_seconds || '0'), 10) ||
            0,
        source_of_truth:
            String(job.source_of_truth || 'host_cron').trim() || 'host_cron',
        publish_strategy:
            String(job.publish_strategy || 'main_auto_guarded').trim() ||
            'main_auto_guarded',
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
    const currentHead = String(payload.current_head || '').trim();
    const remoteHead = String(payload.remote_head || '').trim();
    const dirtyPathsCount =
        parseOptionalInteger(payload.dirty_paths_count) ?? 0;
    const dirtyPathsSample = normalizeStringArray(payload.dirty_paths_sample);
    const dirtyPaths = normalizeStringArray(payload.dirty_paths);
    const healthy =
        state !== 'failed' &&
        ageSeconds !== null &&
        ageSeconds <= Number(job.expected_max_lag_seconds || 0);

    const snapshot = {
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
        repo_path: String(payload.repo_path || job.repo_path || '').trim(),
        branch: String(payload.branch || job.branch || '').trim(),
        status_path: String(job.status_path || '').trim(),
        log_path: String(payload.log_path || job.log_path || '').trim(),
        lock_file: String(payload.lock_file || job.lock_file || '').trim(),
        current_head: currentHead,
        remote_head: remoteHead,
        duration_ms: parseOptionalInteger(payload.duration_ms),
        dirty_paths_count: dirtyPathsCount,
        dirty_paths_sample: dirtyPathsSample,
        dirty_paths: dirtyPaths,
        details: payload,
    };

    snapshot.head_drift = computeHeadDrift(currentHead, remoteHead);
    snapshot.telemetry_gap = computeTelemetryGap(snapshot);
    snapshot.failure_reason = computeFailureReason(snapshot);
    return snapshot;
}

function normalizeSnapshotFromHealth(job, payload = {}) {
    const ageSeconds = parseOptionalInteger(
        payload.ageSeconds ?? payload.age_seconds
    );
    const currentHead = String(
        payload.currentHead || payload.current_head || ''
    ).trim();
    const remoteHead = String(
        payload.remoteHead || payload.remote_head || ''
    ).trim();
    const dirtyPathsCount =
        parseOptionalInteger(
            payload.dirtyPathsCount ?? payload.dirty_paths_count
        ) ?? 0;
    const dirtyPathsSample = normalizeStringArray(
        payload.dirtyPathsSample ?? payload.dirty_paths_sample
    );
    const dirtyPaths = normalizeStringArray(
        payload.dirtyPaths ?? payload.dirty_paths
    );
    const snapshot = {
        key: job.key,
        job_id: String(
            payload.jobId || payload.job_id || job.job_id || ''
        ).trim(),
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
        expected_max_lag_seconds:
            Number.parseInt(
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
        repo_path: String(
            payload.repoPath || payload.repo_path || job.repo_path || ''
        ).trim(),
        branch: String(payload.branch || job.branch || '').trim(),
        status_path: String(
            payload.statusPath || payload.status_path || job.status_path || ''
        ).trim(),
        log_path: String(
            payload.logPath || payload.log_path || job.log_path || ''
        ).trim(),
        lock_file: String(
            payload.lockFile || payload.lock_file || job.lock_file || ''
        ).trim(),
        current_head: currentHead,
        remote_head: remoteHead,
        duration_ms: parseOptionalInteger(
            payload.durationMs ?? payload.duration_ms
        ),
        dirty_paths_count: dirtyPathsCount,
        dirty_paths_sample: dirtyPathsSample,
        dirty_paths: dirtyPaths,
        details: payload,
    };

    snapshot.head_drift =
        payload.headDrift !== undefined || payload.head_drift !== undefined
            ? Boolean(payload.headDrift ?? payload.head_drift)
            : computeHeadDrift(currentHead, remoteHead);
    snapshot.telemetry_gap =
        payload.telemetryGap !== undefined ||
        payload.telemetry_gap !== undefined
            ? Boolean(payload.telemetryGap ?? payload.telemetry_gap)
            : computeTelemetryGap(snapshot);
    snapshot.failure_reason =
        String(payload.failureReason || payload.failure_reason || '').trim() ||
        computeFailureReason(snapshot);
    return snapshot;
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
            const snapshot = {
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
                current_head: '',
                remote_head: '',
                dirty_paths_count: 0,
                dirty_paths_sample: [],
                dirty_paths: [],
                head_drift: false,
                telemetry_gap: false,
                details: null,
            };
            snapshot.failure_reason = computeFailureReason(snapshot);
            return snapshot;
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

    const snapshot = {
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
        current_head: '',
        remote_head: '',
        dirty_paths_count: 0,
        dirty_paths_sample: [],
        dirty_paths: [],
        head_drift: false,
        telemetry_gap: false,
        details: null,
    };
    snapshot.failure_reason = computeFailureReason(snapshot);
    return snapshot;
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
            state: String(job.state || ''),
            age_seconds:
                job.age_seconds === null || job.age_seconds === undefined
                    ? null
                    : Number(job.age_seconds),
            deployed_commit: String(job.deployed_commit || ''),
            last_error_message: String(job.last_error_message || ''),
            failure_reason: String(job.failure_reason || ''),
            dirty_paths_count:
                job.dirty_paths_count === null ||
                job.dirty_paths_count === undefined
                    ? 0
                    : Number(job.dirty_paths_count),
            head_drift: Boolean(job.head_drift),
            telemetry_gap: Boolean(job.telemetry_gap),
            current_head: String(job.current_head || ''),
            remote_head: String(job.remote_head || ''),
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
    computeHeadDrift,
    computeTelemetryGap,
    computeFailureReason,
    parseIsoMillis,
    computeAgeSeconds,
};
