'use strict';

const taskGuards = require('./task-guards');

function normalizeText(value) {
    return String(value || '').trim();
}

function looksLikeOpenClawRuntimeText(text) {
    const corpus = String(text || '').toLowerCase();
    return (
        corpus.includes('openclaw') ||
        corpus.includes('leadops') ||
        corpus.includes('lead ops') ||
        corpus.includes('lead-ai-worker') ||
        corpus.includes('lead_ai_worker') ||
        corpus.includes('lead-ai-queue') ||
        corpus.includes('lead-ai-result') ||
        corpus.includes('operator auth') ||
        corpus.includes('operator-auth') ||
        corpus.includes('operator_auth') ||
        corpus.includes('figo queue') ||
        corpus.includes('figo-ai-bridge') ||
        corpus.includes('figo_queue') ||
        corpus.includes('check-ai-response') ||
        corpus.includes('lib/auth.php') ||
        corpus.includes('lib/leadopsservice.php') ||
        corpus.includes('lib/figo_queue.php') ||
        corpus.includes('controllers/operatorauthcontroller.php') ||
        corpus.includes('controllers/leadaicontroller.php')
    );
}

function normalizePathScopeFromText(text) {
    const corpus = String(text || '').toLowerCase();
    if (looksLikeOpenClawRuntimeText(corpus)) {
        return 'openclaw_runtime';
    }
    if (
        corpus.includes('calendar') ||
        corpus.includes('availability') ||
        corpus.includes('booked')
    ) {
        return 'calendar';
    }
    if (
        corpus.includes('chat') ||
        corpus.includes('figo') ||
        corpus.includes('telegram')
    ) {
        return 'chat';
    }
    if (
        corpus.includes('payment') ||
        corpus.includes('stripe') ||
        corpus.includes('checkout')
    ) {
        return 'payments';
    }
    if (
        corpus.includes('deploy') ||
        corpus.includes('workflow') ||
        corpus.includes('pipeline') ||
        corpus.includes('git sync') ||
        corpus.includes('monitor')
    ) {
        return 'ops';
    }
    if (corpus.includes('auth') || corpus.includes('admin')) {
        return 'auth';
    }
    return 'general';
}

function inferRuntimeImpact(text) {
    const corpus = String(text || '').toLowerCase();
    if (looksLikeOpenClawRuntimeText(corpus)) {
        return 'high';
    }
    if (
        corpus.includes('prod') ||
        corpus.includes('production') ||
        corpus.includes('outage') ||
        corpus.includes('fallando') ||
        corpus.includes('incident')
    ) {
        return 'high';
    }
    if (
        corpus.includes('api') ||
        corpus.includes('booking') ||
        corpus.includes('payment') ||
        corpus.includes('calendar')
    ) {
        return 'high';
    }
    if (
        corpus.includes('workflow') ||
        corpus.includes('ci') ||
        corpus.includes('lint') ||
        corpus.includes('test')
    ) {
        return 'low';
    }
    return 'low';
}

function inferSeverity(signal) {
    const title = String(signal?.title || '').toLowerCase();
    const source = String(signal?.source || '').toLowerCase();
    if (
        Boolean(signal?.critical) ||
        title.includes('[alerta prod]') ||
        title.includes('prod') ||
        title.includes('production monitor')
    ) {
        return 'critical';
    }
    if (source === 'workflow' && title.includes('post-deploy gate')) {
        return 'high';
    }
    if (source === 'workflow' && title.includes('ci')) {
        return 'medium';
    }
    return 'medium';
}

function severityToPriority(severity) {
    switch (String(severity || '').toLowerCase()) {
        case 'critical':
            return 95;
        case 'high':
            return 80;
        case 'low':
            return 35;
        case 'medium':
        default:
            return 60;
    }
}

function computePriorityScore(signal, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const base = severityToPriority(signal.severity || inferSeverity(signal));
    const updatedTs = Date.parse(
        String(signal.updated_at || signal.detected_at || '')
    );
    if (!Number.isFinite(updatedTs)) return base;
    const ageHours = Math.max(0, Math.round((nowTs - updatedTs) / 3600000));
    if (ageHours >= 24) return Math.min(100, base + 12);
    if (ageHours >= 6) return Math.min(100, base + 6);
    return base;
}

function computeSlaDueAt(signal, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const severity = String(
        signal.severity || inferSeverity(signal)
    ).toLowerCase();
    let hours = 48;
    if (severity === 'critical') hours = 4;
    else if (severity === 'high') hours = 12;
    else if (severity === 'low') hours = 72;
    return new Date(nowTs + hours * 3600 * 1000).toISOString();
}

function inferFilesByScope(scope) {
    switch (String(scope || '').toLowerCase()) {
        case 'openclaw_runtime':
            return [
                'figo-ai-bridge.php',
                'lib/figo_queue.php',
                'lib/figo_queue/JobProcessor.php',
                'bin/lead-ai-worker.js',
                'bin/lib/lead-ai-worker.js',
                'lib/auth.php',
                'controllers/OperatorAuthController.php',
            ];
        case 'calendar':
            return [
                'controllers/AvailabilityController.php',
                'controllers/AppointmentController.php',
                'lib/calendar/CalendarAvailabilityService.php',
                'lib/calendar/CalendarBookingService.php',
            ];
        case 'chat':
            return [
                'figo-chat.php',
                'figo-backend.php',
                'src/apps/chat/engine.js',
                'src/apps/chat/ui-engine.js',
            ];
        case 'payments':
            return [
                'controllers/PaymentController.php',
                'payment-lib.php',
                'src/apps/booking/engine.js',
            ];
        case 'ops':
            return ['.github/workflows/ci.yml'];
        case 'auth':
            return ['admin-auth.php', 'controllers/AdminAuthController.php'];
        case 'general':
        default:
            return ['README.md'];
    }
}

function inferFilesByOpenClawSurface(surface) {
    switch (String(surface || '').toLowerCase()) {
        case 'leadops_worker':
            return [
                'bin/lead-ai-worker.js',
                'bin/lib/lead-ai-worker.js',
                'controllers/LeadAiController.php',
                'lib/LeadOpsService.php',
            ];
        case 'operator_auth':
            return ['lib/auth.php', 'controllers/OperatorAuthController.php'];
        case 'figo_queue':
        default:
            return [
                'figo-ai-bridge.php',
                'check-ai-response.php',
                'lib/figo_queue.php',
                'lib/figo_queue/JobProcessor.php',
            ];
    }
}

function inferOpenClawSurfaceFromText(text) {
    return taskGuards.inferOpenClawRuntimeSurface({
        scope: 'openclaw_runtime',
        title: String(text || ''),
        source_ref: String(text || ''),
        files: [String(text || '')],
    });
}

function normalizeWorkflowSlug(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function mapWorkflowSlugToFile(slugRaw) {
    const slug = normalizeWorkflowSlug(slugRaw);
    if (!slug) return '';

    if (slug.startsWith('post-deploy-gate')) {
        return '.github/workflows/post-deploy-gate.yml';
    }
    if (slug.startsWith('post-deploy-fast')) {
        return '.github/workflows/post-deploy-fast.yml';
    }
    if (slug.startsWith('repair-git-sync')) {
        return '.github/workflows/repair-git-sync.yml';
    }
    if (slug === 'ci') return '.github/workflows/ci.yml';
    if (slug === 'agent-governance')
        return '.github/workflows/agent-governance.yml';
    if (slug === 'agent-intake') return '.github/workflows/agent-intake.yml';
    if (slug === 'deploy-hosting')
        return '.github/workflows/deploy-hosting.yml';
    if (slug === 'deploy-staging')
        return '.github/workflows/deploy-staging.yml';
    if (
        slug === 'deploy-frontend-selfhosted' ||
        slug === 'deploy-frontend-self-hosted'
    ) {
        return '.github/workflows/deploy-frontend-selfhosted.yml';
    }
    if (slug === 'production-monitor' || slug === 'prod-monitor') {
        return '.github/workflows/prod-monitor.yml';
    }
    if (slug === 'frontend-premium-qa') {
        return '.github/workflows/frontend-premium-qa.yml';
    }
    if (slug === 'nightly-stability') {
        return '.github/workflows/nightly-stability.yml';
    }
    if (slug === 'weekly-kpi-report' || slug === 'weekly-kpi') {
        return '.github/workflows/weekly-kpi-report.yml';
    }
    if (slug === 'sentry-events-verify' || slug === 'verify-sentry-events') {
        return '.github/workflows/sentry-events-verify.yml';
    }
    if (
        slug === 'calendar-write-smoke' ||
        slug === 'calendar-write-smoke-manual'
    ) {
        return '.github/workflows/calendar-write-smoke.yml';
    }
    return '';
}

function inferWorkflowFileFromCorpus(corpusRaw) {
    const corpus = normalizeWorkflowSlug(corpusRaw);
    if (!corpus) return '';

    if (corpus.includes('deploy-hosting')) {
        return '.github/workflows/deploy-hosting.yml';
    }
    if (corpus.includes('deploy-staging')) {
        return '.github/workflows/deploy-staging.yml';
    }
    if (corpus.includes('deploy-frontend-selfhosted')) {
        return '.github/workflows/deploy-frontend-selfhosted.yml';
    }
    if (corpus.includes('frontend-premium-qa')) {
        return '.github/workflows/frontend-premium-qa.yml';
    }
    if (corpus.includes('nightly-stability')) {
        return '.github/workflows/nightly-stability.yml';
    }
    if (corpus.includes('weekly-kpi-report') || corpus.includes('weekly-kpi')) {
        return '.github/workflows/weekly-kpi-report.yml';
    }
    if (
        corpus.includes('sentry-events-verify') ||
        corpus.includes('verify-sentry-events')
    ) {
        return '.github/workflows/sentry-events-verify.yml';
    }
    if (corpus.includes('post-deploy-fast')) {
        return '.github/workflows/post-deploy-fast.yml';
    }
    if (corpus.includes('post-deploy-gate')) {
        return '.github/workflows/post-deploy-gate.yml';
    }
    if (corpus.includes('repair-git-sync')) {
        return '.github/workflows/repair-git-sync.yml';
    }
    if (corpus.includes('calendar-write-smoke')) {
        return '.github/workflows/calendar-write-smoke.yml';
    }
    if (corpus.includes('agent-governance')) {
        return '.github/workflows/agent-governance.yml';
    }
    if (corpus.includes('agent-intake')) {
        return '.github/workflows/agent-intake.yml';
    }
    if (
        corpus.includes('prod-monitor') ||
        corpus.includes('production-monitor')
    ) {
        return '.github/workflows/prod-monitor.yml';
    }
    return '';
}

function inferWorkflowFileFromSignal(signal) {
    const sourceRef = String(
        signal?.source_ref || signal?.sourceRef || ''
    ).trim();
    const labels = Array.isArray(signal?.labels) ? signal.labels : [];
    const candidates = [];

    if (sourceRef.toLowerCase().startsWith('workflow:')) {
        const parts = sourceRef.split(':');
        if (parts.length >= 2) candidates.push(parts[1]);
    }

    for (const label of labels) {
        const normalized = String(label || '').trim();
        if (!normalized.toLowerCase().startsWith('workflow:')) continue;
        candidates.push(normalized.slice('workflow:'.length));
    }

    for (const candidate of candidates) {
        const mapped = mapWorkflowSlugToFile(candidate);
        if (mapped) return mapped;
    }
    return '';
}

function inferFilesFromSignal(signal, scope) {
    const corpus =
        `${String(signal?.title || '')} ${Array.isArray(signal?.labels) ? signal.labels.join(' ') : ''}`.toLowerCase();
    if (String(scope || '').toLowerCase() === 'openclaw_runtime') {
        const surface = inferOpenClawSurfaceFromText(
            `${String(signal?.title || '')} ${String(signal?.source_ref || signal?.sourceRef || '')} ${Array.isArray(signal?.labels) ? signal.labels.join(' ') : ''}`
        );
        return inferFilesByOpenClawSurface(surface);
    }
    if (String(scope || '').toLowerCase() === 'ops') {
        const workflowFile = inferWorkflowFileFromSignal(signal);
        if (workflowFile) {
            return [workflowFile];
        }
        const corpusWorkflowFile = inferWorkflowFileFromCorpus(corpus);
        if (corpusWorkflowFile) {
            return [corpusWorkflowFile];
        }
        if (corpus.includes('post-deploy')) {
            return ['.github/workflows/post-deploy-gate.yml'];
        }
        if (corpus.includes('git sync')) {
            return ['.github/workflows/repair-git-sync.yml'];
        }
        if (corpus.includes('monitor')) {
            return ['.github/workflows/prod-monitor.yml'];
        }
        if (corpus.includes('ci')) {
            return ['.github/workflows/ci.yml'];
        }
        return ['.github/workflows/ci.yml'];
    }
    return inferFilesByScope(scope);
}

function chooseExecutor(signal, scope) {
    void signal;
    void scope;
    return 'codex';
}

function nextSignalId(signals) {
    let max = 0;
    for (const signal of signals || []) {
        const match = String(signal?.id || '').match(/^SIG-(\d+)$/);
        if (!match) continue;
        max = Math.max(max, Number(match[1]));
    }
    return `SIG-${String(max + 1).padStart(3, '0')}`;
}

function nextAttemptCount(value) {
    const parsed = Number.parseInt(String(value || '0'), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed + 1 : 1;
}

function normalizeSignal(raw, options = {}) {
    const nowIso = String(options.nowIso || new Date().toISOString());
    const source = normalizeText(raw.source || 'manual').toLowerCase();
    const sourceRef = normalizeText(raw.source_ref || raw.sourceRef || '');
    const title = normalizeText(
        raw.title || raw.name || sourceRef || 'Untitled signal'
    );
    const detectedAt = normalizeText(
        raw.detected_at || raw.created_at || nowIso
    );
    const updatedAt = normalizeText(
        raw.updated_at || raw.updatedAt || detectedAt
    );
    const labels = Array.isArray(raw.labels)
        ? raw.labels.map((item) => normalizeText(item)).filter(Boolean)
        : [];
    const fingerprint =
        normalizeText(raw.fingerprint) ||
        `${source}:${sourceRef || title.toLowerCase()}`;
    const runtimeImpact = normalizeText(
        raw.runtime_impact || inferRuntimeImpact(`${title} ${labels.join(' ')}`)
    ).toLowerCase();
    const criticalZone =
        Boolean(raw.critical_zone) ||
        runtimeImpact === 'high' ||
        labels.some((label) =>
            ['critical', 'prod-alert', 'production', 'security'].includes(
                String(label).toLowerCase()
            )
        ) ||
        title.toLowerCase().includes('[alerta prod]');
    const severity = normalizeText(
        raw.severity || inferSeverity({ ...raw, title })
    ).toLowerCase();
    const status = normalizeText(raw.status || 'open').toLowerCase();

    return {
        id: normalizeText(raw.id || ''),
        fingerprint,
        source,
        source_ref: sourceRef,
        title,
        severity,
        critical: criticalZone || severity === 'critical',
        status,
        runtime_impact: runtimeImpact === 'high' ? 'high' : 'low',
        url: normalizeText(raw.url || ''),
        detected_at: detectedAt,
        updated_at: updatedAt,
        labels,
    };
}

function mergeSignals(existingSignals, incomingSignals, options = {}) {
    const nowIso = String(options.nowIso || new Date().toISOString());
    const byFingerprint = new Map();
    const next = [];

    for (const signal of existingSignals || []) {
        const normalized = normalizeSignal(signal, { nowIso });
        if (!normalized.id) normalized.id = nextSignalId(next);
        byFingerprint.set(normalized.fingerprint, normalized);
        next.push(normalized);
    }

    for (const raw of incomingSignals || []) {
        const normalized = normalizeSignal(raw, { nowIso });
        const existing = byFingerprint.get(normalized.fingerprint);
        if (!existing) {
            normalized.id = nextSignalId(next);
            byFingerprint.set(normalized.fingerprint, normalized);
            next.push(normalized);
            continue;
        }
        existing.title = normalized.title || existing.title;
        existing.severity = normalized.severity || existing.severity;
        existing.critical = normalized.critical || existing.critical;
        existing.status = normalized.status || existing.status;
        existing.runtime_impact =
            normalized.runtime_impact || existing.runtime_impact;
        existing.url = normalized.url || existing.url;
        existing.updated_at = normalized.updated_at || existing.updated_at;
        existing.labels = Array.from(
            new Set([...(existing.labels || []), ...(normalized.labels || [])])
        );
    }

    next.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return next;
}

function buildTaskFromSignal(signal, options = {}) {
    const nowIso = String(options.nowIso || new Date().toISOString());
    const labelsCorpus = Array.isArray(signal.labels)
        ? signal.labels.join(' ')
        : '';
    const sourceRef = normalizeText(
        signal.source_ref || signal.sourceRef || ''
    );
    const scopeCorpus = `${signal.title} ${sourceRef} ${labelsCorpus}`;
    const scope = normalizePathScopeFromText(scopeCorpus);
    const severity = String(
        signal.severity || inferSeverity(signal)
    ).toLowerCase();
    const risk =
        severity === 'critical' || severity === 'high' ? 'high' : 'medium';
    const priorityScore = computePriorityScore(
        { ...signal, severity },
        options
    );
    const runtimeImpact = String(
        signal.runtime_impact || inferRuntimeImpact(scopeCorpus)
    ).toLowerCase();
    const criticalZone = Boolean(signal.critical) || runtimeImpact === 'high';
    const owner = normalizeText(options.owner || 'orchestrator');
    const executor = chooseExecutor(
        {
            source: signal.source,
            critical_zone: criticalZone,
            runtime_impact: runtimeImpact,
        },
        scope
    );
    const files =
        Array.isArray(options.files) && options.files.length > 0
            ? options.files
            : inferFilesFromSignal(signal, scope);
    const prompt = `Resolver señal ${sourceRef || signal.title}. Verificar causa raíz, aplicar fix mínimo seguro y adjuntar evidencia en verification/agent-runs/.`;
    const titlePrefix =
        String(signal.source || '').toLowerCase() === 'workflow'
            ? 'Resolver fallo workflow'
            : 'Resolver alerta';

    const task = {
        id: '',
        title: `${titlePrefix}: ${signal.title}`.slice(0, 160),
        owner,
        executor,
        status: 'ready',
        risk,
        scope,
        files,
        source_signal: String(signal.source || 'manual').toLowerCase(),
        source_ref: sourceRef,
        priority_score: priorityScore,
        sla_due_at: computeSlaDueAt({ ...signal, severity }, options),
        last_attempt_at: '',
        attempts: 0,
        blocked_reason: '',
        runtime_impact: runtimeImpact === 'high' ? 'high' : 'low',
        critical_zone: criticalZone,
        acceptance: `Cerrar señal ${sourceRef || signal.title} con evidencia verificable.`,
        acceptance_ref: '',
        evidence_ref: '',
        depends_on: [],
        prompt,
        created_at: String(nowIso).slice(0, 10),
        updated_at: String(nowIso).slice(0, 10),
    };
    if (scope === 'openclaw_runtime') {
        task.runtime_surface = inferOpenClawSurfaceFromText(scopeCorpus);
        task.provider_mode =
            task.runtime_surface === 'operator_auth'
                ? 'google_oauth'
                : 'openclaw_chatgpt';
        task.runtime_transport = 'hybrid_http_cli';
        task.runtime_last_transport = '';
    }
    return taskGuards.ensureTaskDualCodexDefaults(task);
}

function normalizeTaskForScoring(task, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const taskNext = { ...task };
    const severity =
        String(task.risk || '').toLowerCase() === 'high'
            ? 'high'
            : String(task.risk || '').toLowerCase() === 'low'
              ? 'low'
              : 'medium';
    taskNext.priority_score = computePriorityScore(
        { ...task, severity, updated_at: task.updated_at },
        { nowTs }
    );
    if (!String(taskNext.sla_due_at || '').trim()) {
        taskNext.sla_due_at = computeSlaDueAt(
            { severity, updated_at: task.updated_at },
            { nowTs }
        );
    }
    const attempts = Number.parseInt(String(task.attempts || '0'), 10);
    taskNext.attempts =
        Number.isFinite(attempts) && attempts >= 0 ? attempts : 0;
    if (taskNext.attempts >= 2) {
        taskNext.executor = 'codex';
        if (!String(taskNext.blocked_reason || '').trim()) {
            taskNext.blocked_reason = 'auto_escalated_after_retries';
        }
    }
    return taskNext;
}

module.exports = {
    normalizeSignal,
    mergeSignals,
    nextSignalId,
    nextAttemptCount,
    inferSeverity,
    computePriorityScore,
    computeSlaDueAt,
    buildTaskFromSignal,
    normalizeTaskForScoring,
    normalizePathScopeFromText,
    inferFilesByScope,
    inferFilesFromSignal,
    inferWorkflowFileFromSignal,
};
