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

const PILOT_RUNTIME_PROVIDER = 'pilot_runtime';
const OPENCLAW_PROVIDER = 'openclaw_chatgpt';
const OPERATOR_AUTH_CANONICAL_PROVIDER = 'google_oauth';
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
    const facadeUrl = joinUrl(baseUrl, '/admin-auth.php?action=status');
    try {
        const response = await fetchJson(url, { fetchImpl: options.fetchImpl });
        const payload =
            response.payload && typeof response.payload === 'object'
                ? response.payload
                : null;
        if (!response.ok || !payload) {
            let facadeSnapshot = null;
            try {
                const facadeResponse = await fetchJson(facadeUrl, {
                    fetchImpl: options.fetchImpl,
                });
                const facadePayload =
                    facadeResponse.payload &&
                    typeof facadeResponse.payload === 'object'
                        ? facadeResponse.payload
                        : null;
                facadeSnapshot = {
                    verification_url: facadeUrl,
                    ok: Boolean(facadeResponse.ok),
                    http_status: Number(facadeResponse.status || 0),
                    raw_text: String(facadeResponse.raw_text || '').trim(),
                    mode: facadePayload
                        ? String(facadePayload.mode || '').trim()
                        : '',
                    status: facadePayload
                        ? String(facadePayload.status || '').trim()
                        : '',
                    authenticated: facadePayload
                        ? Boolean(facadePayload.authenticated)
                        : false,
                    contract_valid: Boolean(
                        facadePayload &&
                        typeof facadePayload === 'object' &&
                        String(facadePayload.mode || '').trim() &&
                        String(facadePayload.status || '').trim()
                    ),
                    details: facadePayload,
                };
            } catch (facadeError) {
                facadeSnapshot = {
                    verification_url: facadeUrl,
                    ok: false,
                    http_status: 0,
                    raw_text: '',
                    mode: '',
                    status: '',
                    authenticated: false,
                    contract_valid: false,
                    error: String(facadeError?.message || facadeError),
                    details: null,
                };
            }
            return {
                surface: 'operator_auth',
                healthy: false,
                state: 'unhealthy',
                verification_url: url,
                transport: 'http_bridge',
                mode: payload ? String(payload.mode || '').trim() : '',
                status: payload ? String(payload.status || '').trim() : '',
                authenticated: payload ? Boolean(payload.authenticated) : false,
                http_status: Number(response.status || 0),
                error: !response.ok
                    ? `operator_auth_http_${Number(response.status || 0)}`
                    : 'operator_auth_invalid_payload',
                raw_text: String(response.raw_text || '').trim(),
                facade_verification_url:
                    facadeSnapshot?.verification_url || facadeUrl,
                facade_ok: Boolean(facadeSnapshot?.ok),
                facade_http_status: Number(facadeSnapshot?.http_status || 0),
                facade_error: String(facadeSnapshot?.error || '').trim(),
                facade_raw_text: String(facadeSnapshot?.raw_text || '').trim(),
                facade_mode: String(facadeSnapshot?.mode || '').trim(),
                facade_status: String(facadeSnapshot?.status || '').trim(),
                facade_authenticated: Boolean(facadeSnapshot?.authenticated),
                facade_contract_valid: Boolean(facadeSnapshot?.contract_valid),
                facade_details: facadeSnapshot?.details || null,
                details: payload,
            };
        }
        const mode = String(payload.mode || 'disabled').trim();
        const status = String(payload.status || '').trim();
        const recommendedMode = String(payload.recommendedMode || '').trim();
        const contractTransport = String(payload.transport || '').trim();
        const configured = payload.configured === true;
        const healthy = Boolean(
            response.ok &&
            payload.ok !== false &&
            mode === OPERATOR_AUTH_CANONICAL_PROVIDER &&
            recommendedMode === OPERATOR_AUTH_CANONICAL_PROVIDER &&
            contractTransport === 'web_broker' &&
            configured &&
            status !== 'operator_auth_not_configured'
        );
        return {
            surface: 'operator_auth',
            healthy,
            state: healthy ? 'healthy' : 'unhealthy',
            verification_url: url,
            transport: 'http_bridge',
            mode,
            recommended_mode: recommendedMode,
            contract_transport: contractTransport,
            configured,
            status,
            authenticated: Boolean(payload.authenticated),
            http_status: Number(response.status || 0),
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

function describeRuntimeSurface(surface = {}) {
    const key = String(surface.surface || '').trim();
    const state = String(surface.state || 'unknown').trim() || 'unknown';
    const healthy = Boolean(surface.healthy);
    if (!key) {
        return {
            surface: '',
            state,
            healthy,
            blocking: !healthy,
            reason: healthy ? 'healthy' : 'surface_unknown',
            message: healthy ? 'surface healthy' : 'runtime surface unknown',
            next_action: healthy ? '' : 'revisar configuracion de la surface',
        };
    }
    if (healthy) {
        return {
            surface: key,
            state,
            healthy: true,
            blocking: false,
            reason: 'healthy',
            message: `${key} healthy`,
            next_action: '',
        };
    }

    if (key === 'figo_queue') {
        if (
            String(surface.provider_mode || '').trim() === 'legacy_proxy' &&
            surface.gateway_configured === false
        ) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'legacy_proxy_without_gateway',
                message:
                    'figo_queue degradado: bridge sigue en legacy_proxy sin gateway OpenClaw configurado',
                next_action:
                    'migrar figo-ai-bridge a provider_mode=openclaw_chatgpt y dejar gatewayConfigured=true',
            };
        }
        if (surface.openclaw_reachable === false) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'openclaw_unreachable',
                message:
                    'figo_queue unhealthy: el bridge no logra alcanzar OpenClaw',
                next_action:
                    'verificar conectividad y credenciales del bridge HTTP',
            };
        }
        return {
            surface: key,
            state,
            healthy: false,
            blocking: true,
            reason:
                state === 'degraded' ? 'bridge_degraded' : 'bridge_unhealthy',
            message:
                state === 'degraded'
                    ? 'figo_queue degradado: el bridge responde pero no confirma gateway/reachability completos'
                    : 'figo_queue unhealthy: el bridge no esta respondiendo de forma valida',
            next_action:
                'revisar figo-ai-bridge.php y el estado del provider OpenClaw',
        };
    }

    if (key === 'leadops_worker') {
        if (surface.configured === false || surface.mode === 'disabled') {
            return {
                surface: key,
                state: 'degraded',
                healthy: false,
                blocking: false,
                reason: 'worker_disabled',
                message:
                    'leadops_worker degradado: la surface esta deshabilitada o no configurada en health',
                next_action:
                    'habilitar/configurar el worker o excluirlo del corte si no aplica',
            };
        }
        if (surface.degraded) {
            return {
                surface: key,
                state: 'degraded',
                healthy: false,
                blocking: false,
                reason: 'worker_degraded',
                message:
                    'leadops_worker degradado: health reporta el worker en linea pero degradado',
                next_action:
                    'revisar backlog/timing del worker y su ruta de ejecucion',
            };
        }
        return {
            surface: key,
            state: 'degraded',
            healthy: false,
            blocking: false,
            reason: 'worker_unhealthy',
            message:
                'leadops_worker degradado: la surface no pasa la verificacion runtime',
            next_action:
                'revisar health.checks.leadOps y la ruta bin/lead-ai-worker.js',
        };
    }

    if (key === 'operator_auth') {
        if (
            surface.facade_contract_valid &&
            Number(surface.http_status || 0) >= 500
        ) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'facade_only_rollout',
                message:
                    'operator_auth unhealthy: la fachada admin-auth ya publica contrato auth pero operator-auth-status aun no',
                next_action:
                    'desplegar y estabilizar /api.php?resource=operator-auth-status para alinear el surface canonico',
            };
        }
        if (
            Number(surface.http_status || 0) >= 520 &&
            Number(surface.facade_http_status || 0) >= 520
        ) {
            const edgeLabel =
                String(surface.raw_text || '').includes('1033') ||
                String(surface.facade_raw_text || '').includes('1033')
                    ? 'Cloudflare 1033'
                    : 'edge/origen';
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'auth_edge_failure',
                message: `operator_auth unhealthy: el edge esta devolviendo HTTP ${Number(surface.http_status || 0)} en operator-auth-status y ${Number(surface.facade_http_status || 0)} en admin-auth.php?action=status`,
                next_action: `revisar ${edgeLabel}, routing y origen para /api.php?resource=operator-auth-status y /admin-auth.php?action=status`,
            };
        }
        if (
            String(surface.mode || '').trim() &&
            String(surface.mode || '').trim() !==
                OPERATOR_AUTH_CANONICAL_PROVIDER
        ) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'auth_mode_mismatch',
                message:
                    'operator_auth unhealthy: el modo expuesto no coincide con google_oauth',
                next_action:
                    'alinear operator_auth al modo recomendado google_oauth',
            };
        }
        if (
            String(surface.recommended_mode || '').trim() &&
            String(surface.recommended_mode || '').trim() !==
                OPERATOR_AUTH_CANONICAL_PROVIDER
        ) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'auth_recommended_mode_mismatch',
                message:
                    'operator_auth unhealthy: recommendedMode aun no apunta a google_oauth',
                next_action:
                    'publicar recommendedMode=google_oauth en operator-auth-status y admin-auth.php?action=status',
            };
        }
        if (
            String(surface.contract_transport || '').trim() &&
            String(surface.contract_transport || '').trim() !== 'web_broker'
        ) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'auth_transport_misconfigured',
                message:
                    'operator_auth unhealthy: el contrato remoto no publica transport=web_broker',
                next_action:
                    'alinear operator_auth para exponer transport=web_broker en produccion',
            };
        }
        if (
            String(surface.status || '').trim() ===
            'operator_auth_not_configured'
        ) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'operator_auth_not_configured',
                message:
                    'operator_auth unhealthy: la facade existe pero no esta configurada',
                next_action:
                    'completar configuracion de operator auth antes del corte',
            };
        }
        if (Number(surface.http_status || 0) >= 400) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: `auth_status_http_${Number(surface.http_status || 0)}`,
                message: `operator_auth unhealthy: endpoint devolvio HTTP ${Number(surface.http_status || 0)}`,
                next_action:
                    'revisar Cloudflare/origen y la ruta /api.php?resource=operator-auth-status',
            };
        }
        if (String(surface.error || '').trim()) {
            return {
                surface: key,
                state,
                healthy: false,
                blocking: true,
                reason: 'auth_status_unreachable',
                message:
                    'operator_auth unhealthy: el endpoint no respondio de forma valida',
                next_action:
                    'revisar Cloudflare/origen y la ruta /api.php?resource=operator-auth-status',
            };
        }
        return {
            surface: key,
            state,
            healthy: false,
            blocking: true,
            reason: 'operator_auth_unhealthy',
            message:
                'operator_auth unhealthy: la surface no cumple el contrato esperado',
            next_action:
                'revisar /api.php?resource=operator-auth-status y la configuracion auth',
        };
    }

    return {
        surface: key,
        state,
        healthy: false,
        blocking: true,
        reason: 'runtime_surface_unhealthy',
        message: `${key} ${state}`,
        next_action: 'revisar configuracion y health de la surface',
    };
}

function summarizeRuntimeHealth(surfaces = []) {
    const diagnostics = Array.isArray(surfaces)
        ? surfaces.map((surface) => describeRuntimeSurface(surface))
        : [];
    const healthySurfaces = diagnostics
        .filter((item) => item.healthy)
        .map((item) => item.surface);
    const degradedSurfaces = diagnostics
        .filter((item) => item.state === 'degraded')
        .map((item) => item.surface);
    const unhealthySurfaces = diagnostics
        .filter((item) => !item.healthy && item.state !== 'degraded')
        .map((item) => item.surface);
    const blockingSurfaces = diagnostics
        .filter((item) => item.blocking)
        .map((item) => item.surface);
    const state =
        unhealthySurfaces.length > 0
            ? 'unhealthy'
            : degradedSurfaces.length > 0
              ? 'degraded'
              : 'healthy';
    const message = diagnostics
        .map((item) =>
            item.reason === 'healthy'
                ? `${item.surface}=healthy`
                : `${item.surface}=${item.state}(${item.reason})`
        )
        .join(', ');

    return {
        state,
        healthy_surfaces: healthySurfaces,
        degraded_surfaces: degradedSurfaces,
        unhealthy_surfaces: unhealthySurfaces,
        blocking_surfaces: blockingSurfaces,
        healthy_count: healthySurfaces.length,
        degraded_count: degradedSurfaces.length,
        unhealthy_count: unhealthySurfaces.length,
        diagnostics,
        message,
    };
}

async function verifyOpenClawRuntime(options = {}) {
    const surfaces = await Promise.all([
        verifyFigoQueue(options),
        verifyLeadOpsWorker(options),
        verifyOperatorAuth(options),
    ]);
    const summary = summarizeRuntimeHealth(surfaces);
    const helperPath = resolve(
        options.rootPath || process.cwd(),
        'bin',
        'openclaw-runtime-helper.js'
    );
    const cliHelperConfigured = existsSync(helperPath);
    return {
        provider: String(options.provider || PILOT_RUNTIME_PROVIDER).trim(),
        ok: summary.blocking_surfaces.length === 0,
        summary,
        overall_state: summary.state,
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
    const providerMode = normalizeOptionalToken(task?.provider_mode);
    if (runtimeSurface === 'operator_auth') {
        if (
            providerMode !== OPENCLAW_PROVIDER &&
            providerMode !== OPERATOR_AUTH_CANONICAL_PROVIDER
        ) {
            const error = new Error(
                'runtime invoke requiere provider_mode=openclaw_chatgpt|google_oauth'
            );
            error.code = 'invalid_provider_mode';
            throw error;
        }
        return normalizeInvokeResult(
            {
                ok: false,
                mode: 'failed',
                provider: providerMode || OPERATOR_AUTH_CANONICAL_PROVIDER,
                runtime_surface: runtimeSurface,
                runtime_transport: runtimeTransport,
                errorCode: 'invoke_unsupported_surface',
                error: 'operator_auth es una superficie verificable, no invocable',
            },
            {
                provider: providerMode || OPERATOR_AUTH_CANONICAL_PROVIDER,
                runtime_surface: runtimeSurface,
                runtime_transport: runtimeTransport,
            }
        );
    }
    if (providerMode !== OPENCLAW_PROVIDER) {
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
                'codex_transversal'
        ) {
            continue;
        }
        const surfaceKey = normalizeSurface(task?.runtime_surface);
        const providerMode = normalizeOptionalToken(task?.provider_mode);
        const expectedProvider =
            surfaceKey === 'operator_auth'
                ? OPERATOR_AUTH_CANONICAL_PROVIDER
                : OPENCLAW_PROVIDER;
        if (providerMode && providerMode !== expectedProvider) {
            continue;
        }
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
    PILOT_RUNTIME_PROVIDER,
    OPENCLAW_PROVIDER,
    OPERATOR_AUTH_CANONICAL_PROVIDER,
    OPENCLAW_RUNTIME_SURFACES,
    OPENCLAW_RUNTIME_TRANSPORTS,
    resolveRuntimeBaseUrl,
    verifyOpenClawRuntime,
    invokeOpenClawRuntime,
    buildRuntimeBlockingErrors,
};
