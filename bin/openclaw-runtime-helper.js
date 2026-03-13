#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const {
    buildLeadOpsGatewayBody,
    buildLeadOpsResult,
} = require('./lib/lead-ai-worker');

function readStdin() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        process.stdin.on('data', (chunk) => chunks.push(chunk));
        process.stdin.on('end', () =>
            resolve(Buffer.concat(chunks).toString('utf8'))
        );
        process.stdin.on('error', reject);
    });
}

function env(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function gatewayHeaders() {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
    const apiKey = env('OPENCLAW_GATEWAY_API_KEY');
    if (!apiKey) return headers;
    const headerName = env('OPENCLAW_GATEWAY_KEY_HEADER', 'Authorization');
    const prefix = env('OPENCLAW_GATEWAY_KEY_PREFIX', 'Bearer');
    headers[headerName] = prefix ? `${prefix} ${apiKey}` : apiKey;
    return headers;
}

function buildFigoMessages(task) {
    const prompt = String(task?.prompt || task?.title || '').trim();
    const acceptance = String(task?.acceptance || '').trim();
    const system = [
        'Eres el runtime OpenClaw interno de Piel Armonia.',
        acceptance ? `Acceptance: ${acceptance}` : '',
        'Responde de forma breve y accionable.',
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

function buildSyntheticLeadOpsJob(task) {
    const ref = String(task?.source_ref || '').trim();
    const idMatch = ref.match(/(\d{1,9})/);
    const risk = String(task?.risk || '')
        .trim()
        .toLowerCase();
    const corpus = [
        String(task?.prompt || ''),
        String(task?.acceptance || ''),
        String(task?.title || ''),
    ]
        .join(' ')
        .toLowerCase();
    let objective = 'whatsapp_draft';
    if (corpus.includes('service_match') || corpus.includes('servicio')) {
        objective = 'service_match';
    } else if (corpus.includes('call_opening') || corpus.includes('llamada')) {
        objective = 'call_opening';
    }
    return {
        callbackId: idMatch ? Number(idMatch[1]) : 0,
        objective,
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

async function postJson(url, body) {
    const response = await requestJson(url, {
        method: 'POST',
        headers: gatewayHeaders(),
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(
            response?.payload?.error?.message ||
                response?.payload?.error ||
                `Gateway HTTP ${response.status}`
        );
    }
    return response.payload;
}

function requestJson(url, options = {}) {
    return new Promise((resolvePromise, rejectPromise) => {
        let parsedUrl = null;
        try {
            parsedUrl = new URL(url);
        } catch (error) {
            rejectPromise(error);
            return;
        }

        const transport = parsedUrl.protocol === 'https:' ? https : http;
        const headers = { ...(options.headers || {}) };
        const body =
            options.body === undefined || options.body === null
                ? null
                : String(options.body);
        if (body !== null && headers['Content-Length'] === undefined) {
            headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = transport.request(
            parsedUrl,
            {
                method: String(options.method || 'GET').trim() || 'GET',
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
                        payload,
                        raw_text: rawText,
                    });
                });
            }
        );

        req.setTimeout(15000, () => {
            req.destroy(new Error('runtime helper HTTP timeout'));
        });
        req.on('error', rejectPromise);

        if (body !== null) {
            req.write(body);
        }
        req.end();
    });
}

async function main() {
    const [, , subcommand = '', surface = ''] = process.argv;
    if (subcommand !== 'invoke') {
        throw new Error(
            'Uso: node bin/openclaw-runtime-helper.js invoke <figo_queue|leadops_worker>'
        );
    }

    const input = await readStdin();
    const payload = input ? JSON.parse(input) : {};
    const task = payload?.task || {};
    const endpoint = env('OPENCLAW_GATEWAY_ENDPOINT');
    if (!endpoint) {
        throw new Error('OPENCLAW_GATEWAY_ENDPOINT no configurado');
    }

    if (surface === 'figo_queue') {
        const completion = await postJson(endpoint, {
            model: env('OPENCLAW_GATEWAY_MODEL', 'openclaw:main'),
            messages: buildFigoMessages(task),
            max_tokens: 1000,
            temperature: 0.2,
            metadata: {
                source: 'agent-orchestrator-cli-helper',
                taskId: String(task?.id || ''),
            },
        });
        process.stdout.write(
            `${JSON.stringify(
                {
                    ok: true,
                    mode: 'live',
                    provider: 'openclaw_chatgpt',
                    runtime_surface: 'figo_queue',
                    runtime_transport: 'cli_helper',
                    source: 'cli_helper',
                    completion,
                },
                null,
                2
            )}\n`
        );
        return;
    }

    if (surface === 'leadops_worker') {
        const job = buildSyntheticLeadOpsJob(task);
        const gatewayPayload = await postJson(
            endpoint,
            buildLeadOpsGatewayBody(job, {
                model: env('OPENCLAW_GATEWAY_MODEL', 'openclaw:main'),
            })
        );
        process.stdout.write(
            `${JSON.stringify(
                {
                    ok: true,
                    mode: 'live',
                    provider: 'openclaw_chatgpt',
                    runtime_surface: 'leadops_worker',
                    runtime_transport: 'cli_helper',
                    source: 'cli_helper',
                    completion: buildLeadOpsResult(
                        job,
                        gatewayPayload,
                        `openclaw:${env('OPENCLAW_GATEWAY_MODEL', 'openclaw:main')}`
                    ),
                },
                null,
                2
            )}\n`
        );
        return;
    }

    throw new Error(`Superficie no soportada por helper CLI: ${surface}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
