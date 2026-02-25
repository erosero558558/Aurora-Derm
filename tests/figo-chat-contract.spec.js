// @ts-check
/* eslint-disable playwright/no-conditional-in-test, playwright/no-conditional-expect */
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function getEnv(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : fallback;
}

function getChatEndpointPath() {
    const raw = getEnv('TEST_FIGO_CHAT_ENDPOINT_PATH', '/figo-chat.php');
    if (!raw) return '/figo-chat.php';
    return raw.startsWith('/') ? raw : `/${raw}`;
}

function toBoolean(raw, fallback = false) {
    const value = String(raw || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(value)) return true;
    if (['0', 'false', 'no', 'off'].includes(value)) return false;
    return fallback;
}

async function readJsonSafe(response) {
    const text = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = null;
    }
    return { text, parsed };
}

function hasCompletionPayload(payload) {
    return Boolean(
        payload &&
        Array.isArray(payload.choices) &&
        payload.choices.length > 0 &&
        payload.choices[0] &&
        payload.choices[0].message &&
        typeof payload.choices[0].message.content === 'string' &&
        payload.choices[0].message.content.trim() !== ''
    );
}

function assertFailureContract(payload, statusCode) {
    expect(statusCode).toBeGreaterThanOrEqual(400);
    expect(payload).toBeTruthy();
    expect(payload.ok).toBe(false);
    expect(typeof payload.reason).toBe('string');
    expect(payload.reason.trim().length).toBeGreaterThan(0);
    expect(typeof payload.error).toBe('string');
    expect(payload.error.trim().length).toBeGreaterThan(0);
}

test.describe('Figo chat contract', () => {
    test('GET figo chat endpoint expone estado diagnostico consistente', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const endpointPath = getChatEndpointPath();
        const response = await request.get(endpointPath);
        expect(response.status()).toBe(200);

        const { parsed, text } = await readJsonSafe(response);
        expect(
            parsed,
            `GET ${endpointPath} no devolvio JSON valido: ${text}`
        ).toBeTruthy();

        expect(parsed.ok).toBe(true);
        expect(parsed.service).toBe('figo-chat');
        expect(['live', 'degraded']).toContain(String(parsed.mode || ''));
        expect(['legacy_proxy', 'openclaw_queue']).toContain(
            String(parsed.providerMode || '')
        );
        expect(parsed).toHaveProperty('configured');
        expect(parsed).toHaveProperty('recursiveConfigDetected');
        expect(parsed).toHaveProperty('upstreamReachable');

        if (String(parsed.providerMode) === 'openclaw_queue') {
            expect(parsed).toHaveProperty('queueDepth');
            expect(parsed).toHaveProperty('openclawReachable');
            expect(parsed).toHaveProperty('gatewayConfigured');
        }
    });

    test('POST figo chat endpoint responde completion o error explicito (sin silencio)', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const endpointPath = getChatEndpointPath();

        const response = await request.post(endpointPath, {
            data: {
                model: 'figo-assistant',
                messages: [
                    {
                        role: 'user',
                        content:
                            'Hola Figo, responde solo con una frase corta de prueba.',
                    },
                ],
                max_tokens: 120,
                temperature: 0.2,
            },
            timeout: 15000,
        });

        const statusCode = response.status();
        const { parsed, text } = await readJsonSafe(response);
        expect(
            parsed,
            `POST ${endpointPath} no devolvio JSON valido: ${text}`
        ).toBeTruthy();

        if (statusCode >= 400) {
            assertFailureContract(parsed, statusCode);
            return;
        }

        expect(statusCode).toBe(200);
        expect(parsed).toHaveProperty('mode');

        if (String(parsed.mode) === 'queued') {
            expect(typeof parsed.jobId).toBe('string');
            expect(parsed.jobId.trim().length).toBeGreaterThan(0);
            expect(typeof parsed.pollUrl).toBe('string');
            expect(parsed.pollUrl.trim().length).toBeGreaterThan(0);
            return;
        }

        expect(hasCompletionPayload(parsed)).toBe(true);

        const source = String(parsed.source || '');
        const mode = String(parsed.mode || '');
        if (source === 'fallback' || mode === 'degraded') {
            // Si hay degradado/fallback, debe ser explicito y trazable.
            expect(parsed).toHaveProperty('degraded');
            expect(parsed.degraded).toBe(true);
            expect(typeof parsed.reason).toBe('string');
            expect(parsed.reason.trim().length).toBeGreaterThan(0);
        }
    });

    test('POST figo chat endpoint cumple p95 de latencia cuando se habilita benchmark', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const endpointPath = getChatEndpointPath();

        const enabled = toBoolean(getEnv('TEST_FIGO_CHAT_LATENCY', 'false'));
        test.skip(
            !enabled,
            'Benchmark de latencia deshabilitado (TEST_FIGO_CHAT_LATENCY=false).'
        );

        const samples = Number.parseInt(
            getEnv('TEST_FIGO_CHAT_LATENCY_SAMPLES', '6'),
            10
        );
        const maxP95Ms = Number.parseInt(
            getEnv('TEST_FIGO_CHAT_LATENCY_P95_MS', '2500'),
            10
        );
        const safeSamples = Number.isFinite(samples)
            ? Math.min(Math.max(samples, 3), 12)
            : 6;
        const latencies = [];

        for (let i = 0; i < safeSamples; i += 1) {
            const started = Date.now();
            const response = await request.post(endpointPath, {
                data: {
                    model: 'figo-assistant',
                    messages: [
                        {
                            role: 'user',
                            content: `Ping de latencia ${i + 1}/${safeSamples}`,
                        },
                    ],
                    max_tokens: 64,
                    temperature: 0.1,
                },
                timeout: 20000,
            });
            const elapsed = Date.now() - started;
            latencies.push(elapsed);

            const { parsed, text } = await readJsonSafe(response);
            expect(
                parsed,
                `Respuesta no JSON en muestra ${i + 1}: ${text}`
            ).toBeTruthy();
            if (response.status() >= 400) {
                assertFailureContract(parsed, response.status());
            } else if (String(parsed.mode || '') !== 'queued') {
                expect(hasCompletionPayload(parsed)).toBe(true);
            }
        }

        const ordered = latencies.slice().sort((a, b) => a - b);
        const index = Math.max(0, Math.ceil(0.95 * ordered.length) - 1);
        const p95 = ordered[index];
        expect(
            p95,
            `p95 figo-chat ${p95}ms excede umbral ${maxP95Ms}ms (samples=${ordered.join(',')})`
        ).toBeLessThanOrEqual(maxP95Ms);
    });
});
