#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { loadOpenClawOperatorAuthConfig } = require('./operator-auth-config.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_HELPER_BASE_URL = 'http://127.0.0.1:4173';
const DEFAULT_LOGIN_COMMAND =
    'openclaw models auth login --provider openai-codex';
const DEFAULT_OPENCLAW_BIN =
    process.platform === 'win32' ? 'openclaw.cmd' : 'openclaw';

function trimToString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function parsePhpEnvFile(raw) {
    const parsed = {};
    const lines = String(raw || '').split(/\r?\n/);

    for (const line of lines) {
        const match = line.match(
            /^\s*putenv\(\s*(['"])([A-Z0-9_]+)=([\s\S]*?)\1\s*\)\s*;\s*$/
        );
        if (!match) {
            continue;
        }

        const key = trimToString(match[2]);
        const value = String(match[3] || '')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .trim();

        if (key !== '') {
            parsed[key] = value;
        }
    }

    return parsed;
}

function loadPhpEnvFromRepo(repoRoot = REPO_ROOT) {
    const envFile = path.join(repoRoot, 'env.php');
    if (!fs.existsSync(envFile)) {
        return {};
    }

    try {
        return parsePhpEnvFile(fs.readFileSync(envFile, 'utf8'));
    } catch (error) {
        return {};
    }
}

function buildConfig(env = process.env, repoRoot = REPO_ROOT) {
    const phpEnv = loadPhpEnvFromRepo(repoRoot);
    const mergedEnv = {
        ...phpEnv,
        ...env,
    };
    const operatorAuthConfig = loadOpenClawOperatorAuthConfig({
        helperBaseUrl: trimToString(
            mergedEnv.PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL
        ),
        runtimeBaseUrl: trimToString(mergedEnv.OPENCLAW_RUNTIME_BASE_URL),
        bridgeToken: trimToString(
            mergedEnv.PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN
        ),
        bridgeSecret: trimToString(
            mergedEnv.PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET
        ),
        bridgeHeader: trimToString(
            mergedEnv.PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER
        ),
        bridgePrefix: trimToString(
            mergedEnv.PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX
        ),
        helperDeviceId:
            trimToString(mergedEnv.OPENCLAW_HELPER_DEVICE_ID) ||
            trimToString(mergedEnv.PIELARMONIA_OPERATOR_AUTH_DEVICE_ID),
    });

    const helperBaseUrlRaw =
        trimToString(operatorAuthConfig.helperBaseUrl) ||
        DEFAULT_HELPER_BASE_URL;
    const helperBaseUrl = helperBaseUrlRaw.replace(/\/+$/, '');
    const helperUrl = new URL(helperBaseUrl);
    const helperPort = Number.parseInt(helperUrl.port || '80', 10);

    const serverBaseUrl = trimToString(
        mergedEnv.PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL
    ).replace(/\/+$/, '');

    return {
        repoRoot,
        env: mergedEnv,
        helperBaseUrl,
        helperHost: helperUrl.hostname || '127.0.0.1',
        helperPort: Number.isFinite(helperPort) ? helperPort : 4173,
        runtimeBaseUrl: trimToString(operatorAuthConfig.runtimeBaseUrl),
        bridgeToken: trimToString(operatorAuthConfig.bridgeToken),
        bridgeSecret: trimToString(operatorAuthConfig.bridgeSecret),
        bridgeTokenHeader:
            trimToString(operatorAuthConfig.bridgeHeader) || 'Authorization',
        bridgeTokenPrefix:
            trimToString(operatorAuthConfig.bridgePrefix) || 'Bearer',
        serverBaseUrl,
        openclawBin:
            trimToString(mergedEnv.OPENCLAW_BIN) || DEFAULT_OPENCLAW_BIN,
        openclawLoginCommand:
            trimToString(mergedEnv.OPENCLAW_LOGIN_COMMAND) ||
            DEFAULT_LOGIN_COMMAND,
        gatewayApiKey: trimToString(mergedEnv.OPENCLAW_GATEWAY_API_KEY),
        gatewayKeyHeader:
            trimToString(mergedEnv.OPENCLAW_GATEWAY_KEY_HEADER) ||
            'Authorization',
        gatewayKeyPrefix:
            trimToString(mergedEnv.OPENCLAW_GATEWAY_KEY_PREFIX) || 'Bearer',
        deviceId:
            trimToString(operatorAuthConfig.helperDeviceId) ||
            buildDefaultDeviceId(),
    };
}

function buildDefaultDeviceId() {
    const hostname =
        trimToString(os.hostname()).toLowerCase() || 'unknown-host';
    return `operator-auth-bridge:${hostname.replace(/[^a-z0-9._:-]+/g, '-')}`;
}

function extractEmail(value) {
    const match = String(value || '').match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );
    return match ? match[0].toLowerCase() : '';
}

function isOkStatus(value) {
    return trimToString(value).toLowerCase() === 'ok';
}

function resolveIdentityFromModelsStatus(statusPayload) {
    const providers =
        statusPayload &&
        statusPayload.auth &&
        statusPayload.auth.oauth &&
        Array.isArray(statusPayload.auth.oauth.providers)
            ? statusPayload.auth.oauth.providers
            : [];

    const provider = providers.find(
        (entry) => trimToString(entry && entry.provider) === 'openai-codex'
    );

    if (!provider) {
        return {
            ok: false,
            errorCode: 'openclaw_oauth_missing',
            error: 'OpenClaw no tiene un perfil OAuth activo para openai-codex.',
        };
    }

    const profiles = Array.isArray(provider.profiles) ? provider.profiles : [];
    const usableProfile = profiles.find((entry) =>
        isOkStatus(entry && entry.status)
    );

    if (!usableProfile) {
        return {
            ok: false,
            errorCode: 'openclaw_login_required',
            error: 'OpenClaw requiere iniciar sesion con ChatGPT/OpenAI antes de resolver este challenge.',
        };
    }

    const profileId = trimToString(usableProfile.profileId);
    const email =
        extractEmail(usableProfile.label) ||
        extractEmail(usableProfile.profileId) ||
        extractEmail(usableProfile.accountId);

    if (email === '') {
        return {
            ok: false,
            errorCode: 'openclaw_email_missing',
            error: 'OpenClaw no expuso un email resoluble para este perfil.',
        };
    }

    return {
        ok: true,
        identity: {
            email,
            profileId: profileId || `openai-codex:${email}`,
            accountId:
                trimToString(usableProfile.accountId) ||
                trimToString(usableProfile.profileId) ||
                `openai-codex:${email}`,
        },
    };
}

function resolveIdentityFromRuntimeSession(sessionPayload) {
    const payload =
        sessionPayload && typeof sessionPayload === 'object'
            ? sessionPayload
            : {};

    if (payload.loggedIn !== true) {
        const errorCode = trimToString(payload.errorCode || payload.code);
        if (errorCode === 'openclaw_oauth_missing') {
            return {
                ok: false,
                errorCode: 'openclaw_oauth_missing',
                error: 'OpenClaw no encontro un perfil OAuth valido para openai-codex.',
            };
        }

        return {
            ok: false,
            errorCode: 'openclaw_login_required',
            error: 'OpenClaw requiere iniciar sesion con ChatGPT/OpenAI antes de resolver este challenge.',
        };
    }

    const email = extractEmail(payload.email);
    if (email === '') {
        return {
            ok: false,
            errorCode: 'openclaw_email_missing',
            error: 'OpenClaw no expuso un email resoluble para este perfil.',
        };
    }

    const profileId =
        trimToString(payload.profileId) ||
        trimToString(payload.accountId) ||
        `openai-codex:${email}`;
    const accountId = trimToString(payload.accountId) || profileId;

    return {
        ok: true,
        identity: {
            email,
            profileId,
            accountId,
        },
    };
}

function buildGatewayHeaders(config) {
    const headers = {
        Accept: 'application/json',
    };
    if (config.gatewayApiKey === '') {
        return headers;
    }

    headers[config.gatewayKeyHeader] = config.gatewayKeyPrefix
        ? `${config.gatewayKeyPrefix} ${config.gatewayApiKey}`
        : config.gatewayApiKey;
    return headers;
}

function requestJson(urlString, options = {}) {
    return new Promise((resolve, reject) => {
        const target = new URL(urlString);
        const transport = target.protocol === 'https:' ? https : http;
        const request = transport.request(
            {
                method: String(options.method || 'GET').toUpperCase(),
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port || undefined,
                path: `${target.pathname}${target.search}`,
                headers: {
                    Accept: 'application/json',
                    ...(options.headers || {}),
                },
            },
            (response) => {
                let raw = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    raw += chunk;
                });
                response.on('end', () => {
                    let body = null;
                    try {
                        body = raw === '' ? null : JSON.parse(raw);
                    } catch (_error) {
                        body = null;
                    }

                    resolve({
                        ok:
                            Number(response.statusCode || 0) >= 200 &&
                            Number(response.statusCode || 0) < 300,
                        status: Number(response.statusCode || 0),
                        headers: response.headers || {},
                        rawBody: raw,
                        body,
                    });
                });
            }
        );

        request.on('error', reject);
        request.end();
    });
}

async function detectOpenClawIdentity(config, requestJsonImpl = requestJson) {
    try {
        const response = await requestJsonImpl(
            `${config.runtimeBaseUrl}/v1/session`,
            {
                headers: buildGatewayHeaders(config),
            }
        );
        const payload =
            response.body && typeof response.body === 'object'
                ? response.body
                : {};

        if (Array.isArray(payload?.auth?.oauth?.providers)) {
            return resolveIdentityFromModelsStatus(payload);
        }

        if (!response.ok && !payload.errorCode && !payload.code) {
            return {
                ok: false,
                errorCode: 'helper_no_disponible',
                error: 'No se pudo consultar la sesion del runtime OpenClaw local.',
            };
        }

        return resolveIdentityFromRuntimeSession(payload);
    } catch (error) {
        return {
            ok: false,
            errorCode: 'helper_no_disponible',
            error:
                trimToString(error && error.message) ||
                'No se pudo consultar la sesion del runtime OpenClaw local.',
        };
    }
}

function operatorAuthSignaturePayload(payload) {
    const status = trimToString(payload.status || 'completed').toLowerCase();
    const timestamp = trimToString(payload.timestamp);
    const challengeId = trimToString(payload.challengeId);
    const nonce = trimToString(payload.nonce);
    const deviceId = trimToString(payload.deviceId);

    if (status === 'error') {
        return [
            challengeId,
            nonce,
            status,
            trimToString(payload.errorCode),
            trimToString(payload.error),
            deviceId,
            timestamp,
        ].join('\n');
    }

    return [
        challengeId,
        nonce,
        status,
        trimToString(payload.email).toLowerCase(),
        trimToString(payload.profileId),
        trimToString(payload.accountId),
        deviceId,
        timestamp,
    ].join('\n');
}

function signBridgePayload(payload, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(operatorAuthSignaturePayload(payload))
        .digest('hex');
}

function buildCompletionPayload(input, identity, config) {
    const payload = {
        challengeId: trimToString(input.challengeId),
        nonce: trimToString(input.nonce),
        status: 'completed',
        email: trimToString(identity.email).toLowerCase(),
        profileId: trimToString(identity.profileId),
        accountId: trimToString(identity.accountId),
        deviceId: config.deviceId,
        timestamp: new Date().toISOString(),
    };

    payload.signature = signBridgePayload(payload, config.bridgeSecret);
    return payload;
}

function buildErrorPayload(input, errorCode, errorMessage, config) {
    const payload = {
        challengeId: trimToString(input.challengeId),
        nonce: trimToString(input.nonce),
        status: 'error',
        errorCode: trimToString(errorCode) || 'helper_no_disponible',
        error:
            trimToString(errorMessage) ||
            'El helper local no pudo completar la autenticacion.',
        deviceId: config.deviceId,
        timestamp: new Date().toISOString(),
    };

    payload.signature = signBridgePayload(payload, config.bridgeSecret);
    return payload;
}

function buildAuthHeaderValue(config) {
    if (config.bridgeTokenPrefix === '') {
        return config.bridgeToken;
    }

    return `${config.bridgeTokenPrefix} ${config.bridgeToken}`.trim();
}

function postJson(urlString, headers, payload) {
    return new Promise((resolve, reject) => {
        const target = new URL(urlString);
        const transport = target.protocol === 'https:' ? https : http;
        const body = JSON.stringify(payload);

        const request = transport.request(
            {
                method: 'POST',
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port || undefined,
                path: `${target.pathname}${target.search}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    ...headers,
                },
            },
            (response) => {
                let raw = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    raw += chunk;
                });
                response.on('end', () => {
                    let json = null;
                    try {
                        json = JSON.parse(raw);
                    } catch (error) {
                        json = null;
                    }

                    resolve({
                        status: Number(response.statusCode || 0),
                        headers: response.headers || {},
                        rawBody: raw,
                        body: json,
                    });
                });
            }
        );

        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

function isValidChallengeId(value) {
    return /^[a-f0-9]{32}$/i.test(trimToString(value));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildManualResolveCommand(input) {
    return [
        'node bin/operator-auth-bridge.js',
        '--resolve',
        `--challenge-id ${trimToString(input.challengeId)}`,
        `--nonce ${trimToString(input.nonce)}`,
        `--server-base-url ${trimToString(input.serverBaseUrl)}`,
    ].join(' ');
}

function renderSuccessPage(result) {
    const email = escapeHtml(result.identity && result.identity.email);

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autenticacion enviada</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f5f1e8; color: #1d1d1d; }
    main { max-width: 720px; margin: 48px auto; padding: 24px; background: #fffdf8; border: 1px solid #d7cdb9; border-radius: 16px; box-shadow: 0 24px 80px rgba(59,45,25,.12); }
    h1 { margin-top: 0; font-size: 1.75rem; }
    p { line-height: 1.55; }
    .chip { display: inline-block; padding: 6px 10px; border-radius: 999px; font-weight: 600; font-size: 0.875rem; background: #efe7d8; color: #624c23; }
    .chip.success { background: #e4f4e8; color: #1e6a34; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <span class="chip success">Bridge OK</span>
    <h1>Autenticacion enviada</h1>
    <p>La identidad del operador se envio al servidor correctamente.</p>
    <p><strong>Email:</strong> <code>${email}</code></p>
    <p>Puedes volver al panel admin. La sesion deberia pasar a <strong>autenticado</strong> en unos segundos.</p>
  </main>
</body>
</html>`;
}

function renderErrorPage(result, config) {
    const message = escapeHtml(result.error || 'No se pudo completar el login');
    const loginCommand = escapeHtml(config.openclawLoginCommand);
    const manualCommand = escapeHtml(buildManualResolveCommand(result.input));

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>No se pudo completar el login</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f5f1e8; color: #1d1d1d; }
    main { max-width: 720px; margin: 48px auto; padding: 24px; background: #fffdf8; border: 1px solid #d7cdb9; border-radius: 16px; box-shadow: 0 24px 80px rgba(59,45,25,.12); }
    h1 { margin-top: 0; font-size: 1.75rem; }
    p, li { line-height: 1.55; }
    .chip { display: inline-block; padding: 6px 10px; border-radius: 999px; font-weight: 600; font-size: 0.875rem; background: #efe7d8; color: #624c23; }
    .chip.danger { background: #f8e4e4; color: #8a1f1f; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    pre { background: #f2eee6; padding: 12px; border-radius: 12px; overflow-x: auto; }
  </style>
</head>
<body>
  <main>
    <span class="chip danger">Atencion</span>
    <h1>No se pudo completar el login</h1>
    <p>${message}</p>
    <p>Si aun no has iniciado sesion en OpenClaw con ChatGPT/OpenAI, ejecuta:</p>
    <pre>${loginCommand}</pre>
    <p>Luego reintenta con esta misma URL o usa el modo manual:</p>
    <pre>${manualCommand}</pre>
  </main>
</body>
</html>`;
}

function createJsonResult(result, config) {
    return {
        ok: result.ok,
        accepted: result.ok,
        status: result.status,
        error: result.error,
        input: result.input,
        identity: result.identity || null,
        loginCommand: config.openclawLoginCommand,
        manualResolveCommand: buildManualResolveCommand(result.input),
        response: result.response,
    };
}

async function resolveChallenge(input, options = {}) {
    const config = options.config || buildConfig();
    const detectIdentityImpl =
        options.detectIdentityImpl ||
        ((runtimeConfig) => detectOpenClawIdentity(runtimeConfig));

    const normalizedInput = {
        challengeId: trimToString(input && input.challengeId),
        nonce: trimToString(input && input.nonce),
        serverBaseUrl:
            trimToString(input && input.serverBaseUrl) || config.serverBaseUrl,
        manualCode: trimToString(input && input.manualCode),
    };

    if (!isValidChallengeId(normalizedInput.challengeId)) {
        return {
            ok: false,
            status: 'invalid_input',
            error: 'challengeId invalido',
            input: normalizedInput,
        };
    }

    if (normalizedInput.nonce === '') {
        return {
            ok: false,
            status: 'invalid_input',
            error: 'Nonce invalido',
            input: normalizedInput,
        };
    }

    if (normalizedInput.serverBaseUrl === '') {
        return {
            ok: false,
            status: 'invalid_input',
            error: 'serverBaseUrl no configurado',
            input: normalizedInput,
        };
    }

    if (config.bridgeToken === '' || config.bridgeSecret === '') {
        return {
            ok: false,
            status: 'helper_not_configured',
            error: 'Faltan PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN/SECRET para completar el challenge.',
            input: normalizedInput,
        };
    }

    const identityResult = await Promise.resolve(detectIdentityImpl(config));
    const payload = identityResult.ok
        ? buildCompletionPayload(
              normalizedInput,
              identityResult.identity,
              config
          )
        : buildErrorPayload(
              normalizedInput,
              identityResult.errorCode,
              identityResult.error,
              config
          );

    try {
        const response = await postJson(
            `${normalizedInput.serverBaseUrl}/api.php?resource=operator-auth-complete`,
            {
                [config.bridgeTokenHeader]: buildAuthHeaderValue(config),
            },
            payload
        );

        const body =
            response.body && typeof response.body === 'object'
                ? response.body
                : {};
        const status = trimToString(body.status) || 'helper_no_disponible';
        const accepted = response.status === 202 && body.accepted === true;

        return {
            ok: accepted,
            status,
            error: accepted
                ? ''
                : trimToString(body.error) ||
                  trimToString(identityResult.error) ||
                  'No se pudo completar el login',
            input: normalizedInput,
            identity: identityResult.ok ? identityResult.identity : null,
            response: {
                httpStatus: response.status,
                body,
                requestPayload: payload,
            },
        };
    } catch (error) {
        return {
            ok: false,
            status: 'helper_no_disponible',
            error:
                trimToString(error && error.message) ||
                'No se pudo contactar al backend para completar el login.',
            input: normalizedInput,
            identity: identityResult.ok ? identityResult.identity : null,
        };
    }
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function sendHtml(response, statusCode, html) {
    response.writeHead(statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end(html, 'utf8');
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let raw = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            raw += chunk;
        });
        request.on('end', () => resolve(raw));
        request.on('error', reject);
    });
}

function prefersJson(requestUrl, request) {
    if (requestUrl.searchParams.get('format') === 'json') {
        return true;
    }

    const accept = String(request.headers.accept || '').toLowerCase();
    return accept.includes('application/json');
}

function createBridgeServer(config = buildConfig(), options = {}) {
    return http.createServer(async (request, response) => {
        const requestUrl = new URL(request.url || '/', config.helperBaseUrl);
        const pathname = requestUrl.pathname;
        const method = trimToString(request.method || 'GET').toUpperCase();

        if (pathname === '/health') {
            sendJson(response, 200, {
                ok: true,
                service: 'operator-auth-bridge',
                helperBaseUrl: config.helperBaseUrl,
                runtimeBaseUrl: config.runtimeBaseUrl,
                deviceId: config.deviceId,
                serverBaseUrlConfigured: config.serverBaseUrl !== '',
            });
            return;
        }

        if (pathname !== '/resolve') {
            sendJson(response, 404, {
                ok: false,
                error: 'Ruta no encontrada',
            });
            return;
        }

        if (method !== 'GET' && method !== 'POST') {
            sendJson(response, 405, {
                ok: false,
                error: 'Metodo no permitido',
            });
            return;
        }

        let body = {};
        if (method === 'POST') {
            try {
                const raw = await readRequestBody(request);
                body = raw === '' ? {} : JSON.parse(raw);
            } catch (error) {
                sendJson(response, 400, {
                    ok: false,
                    error: 'Body JSON invalido',
                });
                return;
            }
        }

        const result = await resolveChallenge(
            {
                challengeId:
                    requestUrl.searchParams.get('challengeId') ||
                    body.challengeId,
                nonce: requestUrl.searchParams.get('nonce') || body.nonce,
                serverBaseUrl:
                    requestUrl.searchParams.get('serverBaseUrl') ||
                    body.serverBaseUrl ||
                    config.serverBaseUrl,
                manualCode:
                    requestUrl.searchParams.get('manualCode') ||
                    body.manualCode,
            },
            {
                config,
                detectIdentityImpl: options.detectIdentityImpl,
            }
        );

        if (prefersJson(requestUrl, request)) {
            sendJson(
                response,
                result.ok ? 200 : 400,
                createJsonResult(result, config)
            );
            return;
        }

        if (result.ok) {
            sendHtml(response, 200, renderSuccessPage(result));
            return;
        }

        sendHtml(response, 400, renderErrorPage(result, config));
    });
}

function parseCliArgs(argv) {
    const parsed = {
        resolve: false,
        help: false,
        challengeId: '',
        nonce: '',
        serverBaseUrl: '',
        manualCode: '',
        host: '',
        port: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const nextValue = argv[index + 1];

        switch (arg) {
            case '--resolve':
                parsed.resolve = true;
                break;
            case '--challenge-id':
            case '--challengeId':
                parsed.challengeId = trimToString(nextValue);
                index += 1;
                break;
            case '--nonce':
                parsed.nonce = trimToString(nextValue);
                index += 1;
                break;
            case '--server-base-url':
            case '--serverBaseUrl':
                parsed.serverBaseUrl = trimToString(nextValue);
                index += 1;
                break;
            case '--manual-code':
            case '--manualCode':
                parsed.manualCode = trimToString(nextValue);
                index += 1;
                break;
            case '--host':
                parsed.host = trimToString(nextValue);
                index += 1;
                break;
            case '--port':
                parsed.port = trimToString(nextValue);
                index += 1;
                break;
            case '-h':
            case '--help':
                parsed.help = true;
                break;
            default:
                throw new Error(`Argumento no soportado: ${arg}`);
        }
    }

    return parsed;
}

function printHelp() {
    process.stdout.write(
        [
            'Uso:',
            '  node bin/operator-auth-bridge.js',
            '  node bin/operator-auth-bridge.js --resolve --challenge-id <id> --nonce <nonce> --server-base-url <url>',
            '',
            'Modos:',
            '  Sin flags: levanta el helper local HTTP en /health y /resolve.',
            '  --resolve: resuelve un challenge una sola vez y escribe JSON a stdout.',
            '',
        ].join('\n') + '\n'
    );
}

async function runCli(argv = process.argv.slice(2)) {
    const parsed = parseCliArgs(argv);
    if (parsed.help) {
        printHelp();
        return 0;
    }

    const baseConfig = buildConfig();
    const config = {
        ...baseConfig,
        helperHost: parsed.host || baseConfig.helperHost,
        helperPort:
            parsed.port !== ''
                ? Number.parseInt(parsed.port, 10)
                : baseConfig.helperPort,
    };

    if (parsed.resolve) {
        const result = await resolveChallenge(
            {
                challengeId: parsed.challengeId,
                nonce: parsed.nonce,
                serverBaseUrl: parsed.serverBaseUrl,
                manualCode: parsed.manualCode,
            },
            { config }
        );

        process.stdout.write(
            JSON.stringify(createJsonResult(result, config), null, 2) + '\n'
        );
        return result.ok ? 0 : 1;
    }

    const server = createBridgeServer(config);

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(config.helperPort, config.helperHost, () => {
            process.stdout.write(
                `[operator-auth-bridge] listening on ${config.helperBaseUrl}\n`
            );
        });
    });
}

module.exports = {
    REPO_ROOT,
    buildCompletionPayload,
    buildConfig,
    buildErrorPayload,
    createBridgeServer,
    createJsonResult,
    detectOpenClawIdentity,
    loadPhpEnvFromRepo,
    operatorAuthSignaturePayload,
    parseCliArgs,
    parsePhpEnvFile,
    renderErrorPage,
    renderSuccessPage,
    resolveChallenge,
    resolveIdentityFromModelsStatus,
    resolveIdentityFromRuntimeSession,
    runCli,
    signBridgePayload,
};

if (require.main === module) {
    runCli()
        .then((code) => {
            if (Number.isInteger(code)) {
                process.exit(code);
            }
        })
        .catch((error) => {
            process.stderr.write(
                `[operator-auth-bridge] ${error && error.message ? error.message : String(error)}\n`
            );
            process.exit(1);
        });
}
