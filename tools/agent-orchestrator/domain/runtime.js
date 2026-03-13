'use strict';

const { existsSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');
const http = require('http');
const https = require('https');
let leadOpsWorkerHelpers = null;
try {
    leadOpsWorkerHelpers = require('../../../bin/lib/lead-ai-worker');
} catch {
    leadOpsWorkerHelpers = null;
}

const OPENCLAW_PROVIDER = 'openclaw_chatgpt';
const OPENCLAW_RUNTIME_SURFACES = [
    'figo_queue',
    'leadops_worker',
    'operator_auth',
];
const OPENCLAW_RUNTIME_TRANSPORTS = [
    'hybrid_http_cli',
    'http_bridge',
    'cli_helper',
];

function buildLeadOpsGatewayBodyCompat(job, config = {}) {
    if (leadOpsWorkerHelpers?.buildLeadOpsGatewayBody) {
        return leadOpsWorkerHelpers.buildLeadOpsGatewayBody(job, config);
    }
    return {
        model: String(config.model || 'openclaw:main'),
        instructions:
            'Eres un asistente comercial interno para una clinica dermatologica. Mantente breve, claro y accionable.',
        input: [
            `Objetivo: ${String(job?.objective || 'whatsapp_draft')}`,
            `Prioridad: ${String(job?.priorityBand || 'cold')}`,
            `Score: ${Number(job?.heuristicScore || 0)}`,
            `Preferencia: ${String(job?.preferencia || 'Sin preferencia')}`,
            `Sugerencias de servicio: ${Array.isArray(job?.serviceHints) ? job.serviceHints.join(', ') : 'ninguna'}`,
            `Razones: ${Array.isArray(job?.reasonCodes) ? job.reasonCodes.join(', ') : 'ninguna'}`,
            `Siguiente accion: ${String(job?.nextAction || 'n/a')}`,
            'Devuelve JSON con llaves summary y draft.',
        ].join('\n'),
        user:
            Number(job?.callbackId || 0) > 0
                ? `callback:${Number(job.callbackId)}`
                : undefined,
        max_output_tokens: 300,
    };
}

function extractLeadOpsText(payload) {
    if (
        typeof payload?.output_text === 'string' &&
        payload.output_text.trim()
    ) {
        return payload.output_text;
    }
    if (typeof payload?.choices?.[0]?.message?.content === 'string') {
        return payload.choices[0].message.content;
    }
    if (Array.isArray(payload?.output)) {
        return payload.output
            .flatMap((item) =>
                Array.isArray(item?.content)
                    ? item.content.map((part) =>
                          String(part?.text || part?.content || '')
                      )
                    : []
            )
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

function buildLeadOpsResultCompat(job, gatewayPayload, provider) {
    if (leadOpsWorkerHelpers?.buildLeadOpsResult) {
        return leadOpsWorkerHelpers.buildLeadOpsResult(
            job,
            gatewayPayload,
            provider
        );
    }
    const rawText = extractLeadOpsText(gatewayPayload).trim();
    let summary = rawText;
    let draft = '';
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
            const parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
            summary = String(parsed.summary || '').trim() || summary;
            draft = String(parsed.draft || '').trim();
        } catch {
            // noop
        }
    }
    return {
        callbackId: Number(job?.callbackId || 0),
        objective: String(job?.objective || 'whatsapp_draft'),
        status: 'completed',
        summary,
        draft,
        provider: String(provider || 'openclaw'),
    };
}

function baseFromUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return '';
    }
}

function joinUrl(baseUrl, relativePath) {
    const base = String(baseUrl || '')
        .trim()
        .replace(/\/+$/, '');
    const path = String(relativePath || '').trim();
    if (!base) return path;
    if (!path) return base;
    if (/^https?:\/\//i.test(path)) return path;
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function normalizeTransport(value, fallback = 'hybrid_http_cli') {
    const transport = String(value || '')
        .trim()
        .toLowerCase();
    if (OPENCLAW_RUNTIME_TRANSPORTS.includes(transport)) return transport;
    return fallback;
}

function normalizeSurface(value) {
    const surface = String(value || '')
        .trim()
        .toLowerCase();
    if (OPENCLAW_RUNTIME_SURFACES.includes(surface)) return surface;
    return '';
}

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function resolveRuntimeBaseUrl(options = {}) {
    const env = options.env || process.env;
    const governancePolicy = options.governancePolicy || {};
    const candidates = [
        env.OPENCLAW_RUNTIME_BASE_URL,
        env.PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL,
        env.PIELARMONIA_LEADOPS_SERVER_BASE_URL,
        baseFromUrl(governancePolicy?.publishing?.health_url),
        'https://pielarmonia.com',
    ];
    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim();
        if (normalized) return normalized.replace(/\/+$/, '');
    }
    return 'https://pielarmonia.com';
}

async function fetchJson(url, options = {}) {
    const requestOptions = options.request || {};
    try {
        return await requestJsonViaNodeHttp(url, requestOptions);
    } catch (nativeError) {
        const fetchImpl =
            options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
        if (typeof fetchImpl !== 'function') {
            throw nativeError;
        }
        const response = await fetchImpl(url, requestOptions);
        const rawText = await response.text();
        let payload = null;
        try {
            payload = rawText ? JSON.parse(rawText) : null;
        } catch {
            payload = null;
        }
        return {
            ok: response.ok,
            status: response.status,
            url,
            payload,
            raw_text: rawText,
        };
    }
}

function requestJsonViaNodeHttp(url, request = {}) {
    return new Promise((resolvePromise, rejectPromise) => {
        let parsedUrl = null;
        try {
            parsedUrl = new URL(url);
        } catch (error) {
            const invalidUrlError = new Error(
                `URL invalida para runtime: ${String(error?.message || error)}`
            );
            invalidUrlError.code = 'invalid_runtime_url';
            rejectPromise(invalidUrlError);
            return;
        }

        const transport = parsedUrl.protocol === 'https:' ? https : http;
        const headers = { ...(request.headers || {}) };
        const body =
            request.body === undefined || request.body === null
                ? null
                : String(request.body);
        if (body !== null && headers['Content-Length'] === undefined) {
            headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = transport.request(
            parsedUrl,
            {
                method: String(request.method || 'GET').trim() || 'GET',
                headers,
                agent: false,
            },
            (res) => {
                let rawText = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    rawText += chunk;
                });
                res.on('end', () => {
                    let payload = null;
                    try {
                        payload = rawText ? JSON.parse(rawText) : null;
                    } catch {
                        payload = null;
                    }
                    resolvePromise({
                        ok:
                            Number(res.statusCode || 0) >= 200 &&
                            Number(res.statusCode || 0) < 300,
                        status: Number(res.statusCode || 0),
                        url,
                        payload,
                        raw_text: rawText,
                    });
                });
            }
        );

        req.setTimeout(Number(request.timeout ?? 15000), () => {
            req.destroy(new Error('runtime HTTP timeout'));
        });
        req.on('error', (error) => rejectPromise(error));

        if (body !== null) {
            req.write(body);
        }
        req.end();
    });
}

function buildFigoQueueMessages(task) {
    const prompt = String(task?.prompt || task?.title || '').trim();
    const acceptance = String(task?.acceptance || '').trim();
    const scope = String(task?.scope || 'general').trim();
    const files = Array.isArray(task?.files) ? task.files.join(', ') : '';
    const system = [
        'Eres el runtime OpenClaw interno de Piel Armonia.',
        `Task: ${String(task?.id || 'runtime-task').trim() || 'runtime-task'}`,
        `Scope: ${scope || 'general'}`,
        acceptance ? `Acceptance: ${acceptance}` : '',
        files ? `Files: ${files}` : '',
        'Responde de forma accionable y breve.',
    ]
        .filter(Boolean)
        .join('\n');

    return [
        { role: 'system', content: system },
        {
            role: 'user',
            content:
                prompt || String(task?.title || 'Ejecuta la tarea solicitada.'),
        },
    ];
}

function buildFigoQueuePayload(task) {
    const taskId = String(task?.id || 'runtime-task').trim() || 'runtime-task';
    return {
        model: String(process.env.OPENCLAW_GATEWAY_MODEL || 'openclaw:main'),
        messages: buildFigoQueueMessages(task),
        max_tokens: 1000,
        temperature: 0.2,
        metadata: {
            source: 'agent-orchestrator-runtime',
            taskId,
            sessionId: taskId,
        },
        sessionId: taskId,
    };
}

function extractLeadOpsObjective(task) {
    const corpus = [
        String(task?.prompt || ''),
        String(task?.acceptance || ''),
        String(task?.scope || ''),
        String(task?.title || ''),
    ]
        .join(' ')
        .toLowerCase();
    if (corpus.includes('service_match') || corpus.includes('servicio')) {
        return 'service_match';
    }
    if (corpus.includes('call_opening') || corpus.includes('llamada')) {
        return 'call_opening';
    }
    return 'whatsapp_draft';
}

function extractCallbackId(task) {
    const ref = String(task?.source_ref || '').trim();
    const match = ref.match(/(\d{1,9})/);
    return match ? Number(match[1]) : 0;
}

function buildSyntheticLeadOpsJob(task) {
    const risk = normalizeOptionalToken(task?.risk);
    return {
        callbackId: extractCallbackId(task),
        objective: extractLeadOpsObjective(task),
        priorityBand:
            risk === 'high' ? 'hot' : risk === 'medium' ? 'warm' : 'cold',
        heuristicScore: Number(task?.priority_score || 0),
        telefonoMasked: 'n/a',
        preferencia: String(task?.scope || 'Sin preferencia'),
        serviceHints: Array.isArray(task?.files)
            ? task.files.slice(0, 3).map((item) => String(item || ''))
            : [],
        reasonCodes: [
            String(task?.id || ''),
            String(task?.scope || ''),
            String(task?.runtime_surface || ''),
        ].filter(Boolean),
        nextAction: String(task?.acceptance || task?.title || '').slice(0, 180),
    };
}

function gatewayHeadersFromEnv(env = process.env) {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
    const apiKey = String(env.OPENCLAW_GATEWAY_API_KEY || '').trim();
    if (!apiKey) return headers;
    const headerName =
        String(env.OPENCLAW_GATEWAY_KEY_HEADER || 'Authorization').trim() ||
        'Authorization';
    const prefix = String(env.OPENCLAW_GATEWAY_KEY_PREFIX || 'Bearer').trim();
    headers[headerName] = prefix ? `${prefix} ${apiKey}` : apiKey;
    return headers;
}

async function callOpenClawGateway(body, options = {}) {
    const env = options.env || process.env;
    const endpoint = String(env.OPENCLAW_GATEWAY_ENDPOINT || '').trim();
    if (!endpoint) {
        const error = new Error('OPENCLAW_GATEWAY_ENDPOINT no configurado');
        error.code = 'gateway_not_configured';
        throw error;
    }
    const response = await fetchJson(endpoint, {
        fetchImpl: options.fetchImpl,
        request: {
            method: 'POST',
            headers: gatewayHeadersFromEnv(env),
            body: JSON.stringify(body),
        },
    });
    if (!response.ok || !response.payload) {
        const error = new Error(
            response?.payload?.error?.message ||
                response?.payload?.error ||
                `Gateway HTTP ${response.status}`
        );
        error.code = 'gateway_http_error';
        throw error;
    }
    return response.payload;
}

function normalizeInvokeResult(result = {}, fallback = {}) {
    const mode = String(result.mode || fallback.mode || 'failed').trim();
    const provider =
        String(fallback.provider || OPENCLAW_PROVIDER).trim() ||
        OPENCLAW_PROVIDER;
    const upstreamProvider = String(result.provider || '').trim();
    return {
        ok: result.ok !== false && mode !== 'failed',
        mode: ['live', 'queued', 'failed'].includes(mode) ? mode : 'failed',
        provider,
        upstream_provider:
            upstreamProvider && upstreamProvider !== provider
                ? upstreamProvider
                : undefined,
        runtime_surface: String(
            result.runtime_surface || fallback.runtime_surface || ''
        ).trim(),
        runtime_transport: String(
            result.runtime_transport || fallback.runtime_transport || ''
        ).trim(),
        jobId: result.jobId ? String(result.jobId) : undefined,
        pollUrl: result.pollUrl ? String(result.pollUrl) : undefined,
        pollAfterMs: Number.isFinite(Number(result.pollAfterMs))
            ? Number(result.pollAfterMs)
            : undefined,
        completion:
            result.completion && typeof result.completion === 'object'
                ? result.completion
                : undefined,
        errorCode: result.errorCode ? String(result.errorCode) : undefined,
        error: result.error ? String(result.error) : undefined,
        diagnostics: Array.isArray(result.diagnostics)
            ? result.diagnostics
            : [],
        source:
            String(result.source || fallback.source || '').trim() || undefined,
    };
}

async function verifyFigoQueue(options = {}) {
    const baseUrl = resolveRuntimeBaseUrl(options);
    const url = joinUrl(baseUrl, '/figo-ai-bridge.php');
    try {
        const response = await fetchJson(url, { fetchImpl: options.fetchImpl });
        const payload = response.payload || {};
        const gatewayConfigured = payload.gatewayConfigured !== false;
        const reachable = payload.openclawReachable;
        const healthy = Boolean(
            response.ok &&
            payload.ok !== false &&
            gatewayConfigured &&
            reachable !== false
        );
        const state = healthy
            ? 'healthy'
            : reachable === null && response.ok
              ? 'degraded'
              : 'unhealthy';
        return {
            surface: 'figo_queue',
            healthy,
            state,
            verification_url: url,
            transport: 'http_bridge',
            provider_mode: String(payload.providerMode || ''),
            gateway_configured: gatewayConfigured,
            openclaw_reachable: reachable,
            details: payload,
        };
    } catch (error) {
        return {
            surface: 'figo_queue',
            healthy: false,
            state: 'unhealthy',
            verification_url: url,
            transport: 'http_bridge',
            error: String(error?.message || error),
        };
    }
}

async function verifyLeadOpsWorker(options = {}) {
    const baseUrl = resolveRuntimeBaseUrl(options);
    const url = joinUrl(baseUrl, '/api.php?resource=health');
    try {
        const response = await fetchJson(url, { fetchImpl: options.fetchImpl });
        const payload = response.payload || {};
        const leadOps = payload?.checks?.leadOps || {};
        const mode = String(
            leadOps.mode || payload.leadOpsMode || 'disabled'
        ).trim();
        const configured =
            leadOps.configured !== undefined
                ? Boolean(leadOps.configured)
                : mode !== 'disabled';
        const degraded =
            leadOps.degraded !== undefined
                ? Boolean(leadOps.degraded)
                : Boolean(payload.leadOpsWorkerDegraded);
        const healthy = Boolean(
            response.ok && configured && mode === 'online' && !degraded
        );
        const state = healthy
            ? 'healthy'
            : response.ok && configured && mode === 'pending'
              ? 'degraded'
              : 'unhealthy';
        return {
            surface: 'leadops_worker',
            healthy,
            state,
            verification_url: url,
            transport: 'http_bridge',
            configured,
            mode,
            degraded,
            details: payload,
        };
    } catch (error) {
        return {
            surface: 'leadops_worker',
            healthy: false,
            state: 'unhealthy',
            verification_url: url,
            transport: 'http_bridge',
            error: String(error?.message || error),
        };
    }
}

async function verifyOperatorAuth(options = {}) {
    const baseUrl = resolveRuntimeBaseUrl(options);
    const url = joinUrl(baseUrl, '/api.php?resource=operator-auth-status');
    try {
        const response = await fetchJson(url, { fetchImpl: options.fetchImpl });
        const payload = response.payload || {};
        const mode = String(payload.mode || 'disabled').trim();
        const status = String(payload.status || '').trim();
        const healthy = Boolean(
            response.ok &&
            payload.ok !== false &&
            mode === OPENCLAW_PROVIDER &&
            status !== 'operator_auth_not_configured'
        );
        return {
            surface: 'operator_auth',
            healthy,
            state: healthy ? 'healthy' : 'unhealthy',
            verification_url: url,
            transport: 'http_bridge',
            mode,
            status,
            authenticated: Boolean(payload.authenticated),
            details: payload,
        };
    } catch (error) {
        return {
            surface: 'operator_auth',
            healthy: false,
            state: 'unhealthy',
            verification_url: url,
            transport: 'http_bridge',
            error: String(error?.message || error),
        };
    }
}

async function verifyOpenClawRuntime(options = {}) {
    const surfaces = await Promise.all([
        verifyFigoQueue(options),
        verifyLeadOpsWorker(options),
        verifyOperatorAuth(options),
    ]);
    const helperPath = resolve(
        options.rootPath || process.cwd(),
        'bin',
        'openclaw-runtime-helper.js'
    );
    const cliHelperConfigured = existsSync(helperPath);
    return {
        provider: OPENCLAW_PROVIDER,
        ok: surfaces.every((surface) => surface.healthy),
        preferred_transport: 'http_bridge',
        default_transport: 'hybrid_http_cli',
        base_url: resolveRuntimeBaseUrl(options),
        transports: {
            http_bridge: {
                configured: true,
                ready: surfaces.every((item) => item.state !== 'unhealthy'),
            },
            cli_helper: {
                configured: cliHelperConfigured,
                ready: cliHelperConfigured,
            },
            hybrid_http_cli: {
                configured: true,
                ready:
                    surfaces.every((item) => item.state !== 'unhealthy') ||
                    cliHelperConfigured,
            },
        },
        surfaces,
    };
}

async function invokeFigoQueueHttp(task, options = {}) {
    const baseUrl = resolveRuntimeBaseUrl(options);
    const url = joinUrl(baseUrl, '/figo-ai-bridge.php');
    const response = await fetchJson(url, {
        fetchImpl: options.fetchImpl,
        request: {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildFigoQueuePayload(task)),
        },
    });
    if (!response.payload) {
        throw new Error(
            `figo-ai-bridge devolvio respuesta invalida (${response.status})`
        );
    }
    return normalizeInvokeResult(response.payload, {
        provider: OPENCLAW_PROVIDER,
        runtime_surface: 'figo_queue',
        runtime_transport: 'http_bridge',
        source: 'http_bridge',
    });
}

async function invokeLeadOpsWorkerHttp(task, options = {}) {
    const job = buildSyntheticLeadOpsJob(task);
    const body = buildLeadOpsGatewayBodyCompat(job, {
        model: String(process.env.OPENCLAW_GATEWAY_MODEL || 'openclaw:main'),
    });
    const payload = await callOpenClawGateway(body, options);
    return normalizeInvokeResult(
        {
            ok: true,
            mode: 'live',
            provider: OPENCLAW_PROVIDER,
            runtime_surface: 'leadops_worker',
            runtime_transport: 'http_bridge',
            completion: buildLeadOpsResultCompat(
                job,
                payload,
                `openclaw:${String(process.env.OPENCLAW_GATEWAY_MODEL || 'openclaw:main')}`
            ),
            source: 'openclaw_gateway',
        },
        {
            provider: OPENCLAW_PROVIDER,
            runtime_surface: 'leadops_worker',
            runtime_transport: 'http_bridge',
        }
    );
}

function invokeViaCliHelper(task, options = {}) {
    const helperPath = resolve(
        options.rootPath || process.cwd(),
        'bin',
        'openclaw-runtime-helper.js'
    );
    if (!existsSync(helperPath)) {
        const error = new Error(`No existe helper CLI: ${helperPath}`);
        error.code = 'cli_helper_missing';
        throw error;
    }
    const surface = normalizeSurface(task?.runtime_surface);
    const result = spawnSync(
        process.execPath,
        [helperPath, 'invoke', surface],
        {
            cwd: options.rootPath || process.cwd(),
            input: JSON.stringify({ task }, null, 2),
            encoding: 'utf8',
            maxBuffer: 2 * 1024 * 1024,
        }
    );
    if (result.status !== 0) {
        throw new Error(
            String(result.stderr || result.stdout || 'CLI helper fallo').trim()
        );
    }
    let parsed = null;
    try {
        parsed = JSON.parse(String(result.stdout || '{}'));
    } catch (error) {
        throw new Error(`CLI helper devolvio JSON invalido: ${error.message}`);
    }
    return normalizeInvokeResult(parsed, {
        provider: OPENCLAW_PROVIDER,
        runtime_surface: surface,
        runtime_transport: 'cli_helper',
        source: 'cli_helper',
    });
}

async function invokeOpenClawRuntime(task, options = {}) {
    const runtimeSurface = normalizeSurface(task?.runtime_surface);
    const runtimeTransport = normalizeTransport(task?.runtime_transport);
    if (normalizeOptionalToken(task?.provider_mode) !== OPENCLAW_PROVIDER) {
        const error = new Error(
            'runtime invoke requiere provider_mode=openclaw_chatgpt'
        );
        error.code = 'invalid_provider_mode';
        throw error;
    }
    if (!runtimeSurface) {
        const error = new Error(
            'runtime invoke requiere runtime_surface valido'
        );
        error.code = 'invalid_runtime_surface';
        throw error;
    }
    if (runtimeSurface === 'operator_auth') {
        return normalizeInvokeResult(
            {
                ok: false,
                mode: 'failed',
                provider: OPENCLAW_PROVIDER,
                runtime_surface: runtimeSurface,
                runtime_transport: runtimeTransport,
                errorCode: 'invoke_unsupported_surface',
                error: 'operator_auth es una superficie verificable, no invocable',
            },
            {
                provider: OPENCLAW_PROVIDER,
                runtime_surface: runtimeSurface,
                runtime_transport: runtimeTransport,
            }
        );
    }

    const diagnostics = [];
    const tryHttp = async () => {
        if (runtimeSurface === 'figo_queue') {
            return invokeFigoQueueHttp(task, options);
        }
        return invokeLeadOpsWorkerHttp(task, options);
    };

    if (
        runtimeTransport === 'http_bridge' ||
        runtimeTransport === 'hybrid_http_cli'
    ) {
        try {
            const result = await tryHttp();
            if (!result.ok && runtimeTransport === 'hybrid_http_cli') {
                diagnostics.push({
                    transport: 'http_bridge',
                    error:
                        String(
                            result.errorCode ||
                                result.error ||
                                'http_bridge_failed'
                        ).trim() || 'http_bridge_failed',
                });
            } else {
                result.runtime_transport = 'http_bridge';
                result.diagnostics = diagnostics;
                return result;
            }
        } catch (error) {
            diagnostics.push({
                transport: 'http_bridge',
                error: String(error?.message || error),
            });
            if (runtimeTransport === 'http_bridge') {
                return normalizeInvokeResult(
                    {
                        ok: false,
                        mode: 'failed',
                        provider: OPENCLAW_PROVIDER,
                        runtime_surface: runtimeSurface,
                        runtime_transport: 'http_bridge',
                        errorCode: 'http_bridge_failed',
                        error: String(error?.message || error),
                        diagnostics,
                    },
                    {
                        provider: OPENCLAW_PROVIDER,
                        runtime_surface: runtimeSurface,
                        runtime_transport: 'http_bridge',
                    }
                );
            }
        }
    }

    try {
        const result = invokeViaCliHelper(task, options);
        result.runtime_transport = 'cli_helper';
        result.diagnostics = diagnostics;
        return result;
    } catch (error) {
        diagnostics.push({
            transport: 'cli_helper',
            error: String(error?.message || error),
        });
        return normalizeInvokeResult(
            {
                ok: false,
                mode: 'failed',
                provider: OPENCLAW_PROVIDER,
                runtime_surface: runtimeSurface,
                runtime_transport: 'cli_helper',
                errorCode: 'cli_helper_failed',
                error: String(error?.message || error),
                diagnostics,
            },
            {
                provider: OPENCLAW_PROVIDER,
                runtime_surface: runtimeSurface,
                runtime_transport: 'cli_helper',
            }
        );
    }
}

function buildRuntimeBlockingErrors(tasks, verification) {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const surfaces = Array.isArray(verification?.surfaces)
        ? verification.surfaces
        : [];
    const surfaceByKey = new Map(
        surfaces.map((surface) => [
            String(surface.surface || '')
                .trim()
                .toLowerCase(),
            surface,
        ])
    );
    const errors = [];

    for (const task of safeTasks) {
        const status = normalizeOptionalToken(task?.status);
        if (!['ready', 'in_progress', 'review', 'blocked'].includes(status)) {
            continue;
        }
        if (
            normalizeOptionalToken(task?.codex_instance) !==
                'codex_transversal' ||
            normalizeOptionalToken(task?.provider_mode) !== OPENCLAW_PROVIDER
        ) {
            continue;
        }
        const surfaceKey = normalizeSurface(task?.runtime_surface);
        const surface = surfaceByKey.get(surfaceKey);
        if (!surface || !surface.healthy) {
            errors.push(
                `${String(task?.id || '(sin id)')}: runtime_surface=${surfaceKey || 'vacio'} no saludable para codex_transversal`
            );
        }
    }

    return errors;
}

module.exports = {
    OPENCLAW_PROVIDER,
    OPENCLAW_RUNTIME_SURFACES,
    OPENCLAW_RUNTIME_TRANSPORTS,
    resolveRuntimeBaseUrl,
    verifyOpenClawRuntime,
    invokeOpenClawRuntime,
    buildRuntimeBlockingErrors,
};
