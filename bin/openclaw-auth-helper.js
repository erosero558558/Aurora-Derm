#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const http = require('http');
const os = require('os');
const {
    buildOpenClawGatewayHeaders,
    buildOperatorAuthBridgeHeaders,
    env,
    loadOpenClawHelperServerConfig,
    loadOpenClawOperatorAuthConfig,
    trimTrailingSlash,
} = require('./lib/operator-auth-config.js');
const {
    operatorAuthSignaturePayload,
    signOperatorAuthPayload,
} = require('./lib/operator-auth-signature.js');

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function loadHelperConfig(overrides = {}) {
    return loadOpenClawHelperServerConfig(overrides);
}

function helperGatewayHeaders() {
    return buildOpenClawGatewayHeaders();
}

function bridgeHeaders() {
    return buildOperatorAuthBridgeHeaders();
}

function bridgeSecret() {
    return loadOpenClawOperatorAuthConfig().bridgeSecret;
}

function buildDeviceId() {
    const explicit = env('OPENCLAW_HELPER_DEVICE_ID');
    if (explicit) {
        return explicit;
    }

    const userInfo = os.userInfo({ encoding: 'utf8' });
    return [
        'helper',
        crypto
            .createHash('sha256')
            .update(`${os.hostname()}:${userInfo.username || 'operator'}`)
            .digest('hex')
            .slice(0, 16),
    ].join('-');
}

function signBridgePayload(payload, secretOverride = '') {
    const secret = String(secretOverride || '').trim() || bridgeSecret();
    if (!secret) {
        throw new Error('Falta PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET');
    }
    return signOperatorAuthPayload(payload, secret);
}

async function requestJson(url, options = {}) {
    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
    };
    const init = {
        method: String(options.method || 'GET').toUpperCase(),
        headers,
        body: options.body,
    };
    if (init.body !== undefined && init.body !== null) {
        init.headers['Content-Type'] =
            init.headers['Content-Type'] || 'application/json';
    }

    const response = await fetch(url, init);
    const rawText = await response.text();
    let payload;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (_error) {
        payload = null;
    }

    return {
        ok: response.ok,
        status: response.status,
        payload,
        rawText,
    };
}

function buildResolveUrl(config, query) {
    const basePath = config.helperBasePath || '';
    const baseUrl = new URL(
        `${basePath}/resolve`,
        trimTrailingSlash(config.helperBaseUrl) + '/'
    );

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }
        baseUrl.searchParams.set(key, String(value));
    });

    return baseUrl.toString();
}

async function fetchRuntimeSession(config) {
    return requestJson(`${config.runtimeBaseUrl}/v1/session`, {
        headers: helperGatewayHeaders(),
    });
}

async function requestRuntimeLogin(config, context) {
    return requestJson(`${config.runtimeBaseUrl}/v1/session/login`, {
        method: 'POST',
        headers: helperGatewayHeaders(),
        body: JSON.stringify({
            challengeId: context.challengeId,
            manualCode: context.manualCode,
            returnUrl: buildResolveUrl(config, context.rawQuery),
        }),
    });
}

async function postBridgeCompletion(serverBaseUrl, payload) {
    const signedPayload = {
        ...payload,
        signature: signBridgePayload(payload),
    };

    return requestJson(
        `${trimTrailingSlash(serverBaseUrl)}/api.php?resource=operator-auth-complete`,
        {
            method: 'POST',
            headers: bridgeHeaders(),
            body: JSON.stringify(signedPayload),
        }
    );
}

function normalizeResolveContext(url) {
    const params = url.searchParams;
    return {
        challengeId: String(params.get('challengeId') || '').trim(),
        nonce: String(params.get('nonce') || '').trim(),
        serverBaseUrl: trimTrailingSlash(
            String(params.get('serverBaseUrl') || '').trim()
        ),
        manualCode: String(params.get('manualCode') || '').trim(),
        rawQuery: {
            challengeId: params.get('challengeId') || '',
            nonce: params.get('nonce') || '',
            serverBaseUrl: params.get('serverBaseUrl') || '',
            manualCode: params.get('manualCode') || '',
        },
    };
}

function mapRuntimeErrorCodeToBridge(errorCode) {
    const normalized = String(errorCode || '')
        .trim()
        .toLowerCase();
    if (
        normalized === 'openclaw_not_logged_in' ||
        normalized === 'openclaw_oauth_missing' ||
        normalized === 'openclaw_login_required'
    ) {
        return normalized;
    }
    return 'helper_no_disponible';
}

function buildBridgeErrorMessage(errorCode) {
    switch (errorCode) {
        case 'openclaw_not_logged_in':
        case 'openclaw_login_required':
            return 'Debes iniciar sesion en OpenClaw antes de continuar.';
        case 'openclaw_oauth_missing':
            return 'OpenClaw no expuso una sesion OAuth util para este operador.';
        default:
            return 'El helper local no pudo completar la autenticacion.';
    }
}

function normalizeRuntimeSession(runtimeResponse) {
    const payload = runtimeResponse.payload || {};
    if (runtimeResponse.ok && payload.loggedIn === true) {
        return {
            status: 'authenticated',
            email: String(payload.email || '')
                .trim()
                .toLowerCase(),
            profileId: String(payload.profileId || '').trim(),
            accountId: String(payload.accountId || '').trim(),
            provider: String(payload.provider || 'openclaw_chatgpt').trim(),
        };
    }

    const errorCode = mapRuntimeErrorCodeToBridge(
        payload.errorCode ||
            payload.code ||
            (payload.loggedIn === false
                ? 'openclaw_not_logged_in'
                : 'helper_no_disponible')
    );

    return {
        status: 'error',
        errorCode,
        error: String(payload.error || buildBridgeErrorMessage(errorCode)),
    };
}

async function reportBridgeError(context, errorCode, errorMessage) {
    return postBridgeCompletion(context.serverBaseUrl, {
        challengeId: context.challengeId,
        nonce: context.nonce,
        status: 'error',
        errorCode,
        error: errorMessage,
        deviceId: buildDeviceId(),
        timestamp: new Date().toISOString(),
    });
}

async function resolveOperatorChallenge(context, options = {}) {
    if (!context.challengeId || !context.nonce || !context.serverBaseUrl) {
        return {
            ok: false,
            status: 'helper_no_disponible',
            errorCode: 'helper_no_disponible',
            error: 'Faltan parametros obligatorios del challenge.',
        };
    }

    const config = loadHelperConfig(options);
    const runtimeSessionResponse = await fetchRuntimeSession(config);
    const session = normalizeRuntimeSession(runtimeSessionResponse);

    if (session.status === 'authenticated') {
        const bridgeResponse = await postBridgeCompletion(
            context.serverBaseUrl,
            {
                challengeId: context.challengeId,
                nonce: context.nonce,
                status: 'completed',
                email: session.email,
                profileId: session.profileId,
                accountId: session.accountId,
                deviceId: buildDeviceId(),
                timestamp: new Date().toISOString(),
            }
        );

        const bridgePayload = bridgeResponse.payload || {};
        return {
            ok: bridgeResponse.ok,
            status: String(bridgePayload.status || 'completed'),
            challengeId: context.challengeId,
            manualCode: context.manualCode,
            provider: session.provider,
            bridgeStatus: bridgeResponse.status,
            bridgePayload,
        };
    }

    let loginUrl = '';
    let errorCode = session.errorCode || 'helper_no_disponible';
    let errorMessage = session.error || buildBridgeErrorMessage(errorCode);

    try {
        const runtimeLoginResponse = await requestRuntimeLogin(config, context);
        if (
            runtimeLoginResponse.ok &&
            runtimeLoginResponse.payload &&
            typeof runtimeLoginResponse.payload.loginUrl === 'string'
        ) {
            loginUrl = String(
                runtimeLoginResponse.payload.loginUrl || ''
            ).trim();
            if (loginUrl) {
                errorCode = 'openclaw_login_required';
                errorMessage = buildBridgeErrorMessage(errorCode);
            }
        }
    } catch (_error) {
        // Se reporta el error normalizado justo abajo.
    }

    const bridgeResponse = await reportBridgeError(
        context,
        errorCode,
        errorMessage
    );
    const bridgePayload = bridgeResponse.payload || {};

    return {
        ok: false,
        status: String(
            bridgePayload.status ||
                (errorCode === 'helper_no_disponible'
                    ? 'helper_no_disponible'
                    : 'openclaw_no_logueado')
        ),
        errorCode,
        error: String(bridgePayload.error || errorMessage),
        loginUrl,
        challengeId: context.challengeId,
        manualCode: context.manualCode,
        bridgeStatus: bridgeResponse.status,
        bridgePayload,
    };
}

function prefersJsonResponse(req, url) {
    if (url.searchParams.get('format') === 'json') {
        return true;
    }
    const accept = String(req.headers.accept || '').toLowerCase();
    return accept.includes('application/json');
}

function renderResolveHtml(result) {
    const isSuccess = result.status === 'completed';
    const isLoginRequired = result.status === 'openclaw_no_logueado';
    const title = isSuccess
        ? 'Sesion validada'
        : isLoginRequired
          ? 'Completa tu inicio de sesion en OpenClaw'
          : 'No se pudo completar la autenticacion';
    const description = isSuccess
        ? 'Puedes volver al panel. La sesion admin ya fue autorizada.'
        : result.error || 'El helper local no pudo completar la autenticacion.';
    const action = result.loginUrl
        ? `<a class="helper-btn helper-btn-primary" href="${escapeHtml(
              result.loginUrl
          )}" target="_blank" rel="noopener">Abrir login de OpenClaw</a>`
        : '';
    const manualCode = result.manualCode
        ? `<div class="helper-code"><span>Codigo manual</span><strong>${escapeHtml(
              result.manualCode
          )}</strong></div>`
        : '';
    const autoLaunchScript = result.loginUrl
        ? `<script>window.setTimeout(function(){ try { window.open(${JSON.stringify(
              result.loginUrl
          )}, '_blank', 'noopener'); } catch(_error) {} }, 180);</script>`
        : '';
    const closeScript = isSuccess
        ? '<script>window.setTimeout(function(){ try { window.close(); } catch(_error) {} }, 1500);</script>'
        : '';

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17202a;
      --muted: #5d6975;
      --line: rgba(23, 32, 42, 0.12);
      --surface: #ffffff;
      --surface-alt: #f6f8fb;
      --accent: #184b73;
      --success: #1f7a4f;
      --warning: #9d6a10;
      --danger: #a3352b;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at top, rgba(24, 75, 115, 0.1), transparent 52%),
        linear-gradient(180deg, #eef3f8 0%, #f7f9fc 100%);
      color: var(--ink);
      font: 16px/1.5 "Segoe UI", system-ui, sans-serif;
    }
    .helper-shell {
      width: min(560px, calc(100vw - 32px));
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 28px;
      box-shadow: 0 24px 80px rgba(18, 24, 31, 0.14);
      padding: 28px;
      display: grid;
      gap: 18px;
    }
    .helper-shell[data-state="success"] { border-color: rgba(31, 122, 79, 0.24); }
    .helper-shell[data-state="warning"] { border-color: rgba(157, 106, 16, 0.24); }
    .helper-shell[data-state="danger"] { border-color: rgba(163, 53, 43, 0.24); }
    .helper-kicker {
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0;
    }
    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.12;
    }
    p {
      margin: 0;
      color: var(--muted);
    }
    .helper-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .helper-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 700;
      border: 1px solid var(--line);
      color: var(--ink);
      background: var(--surface-alt);
    }
    .helper-btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .helper-code {
      display: grid;
      gap: 6px;
      padding: 16px 18px;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: var(--surface-alt);
    }
    .helper-code span {
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .helper-code strong {
      font-size: 22px;
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>
  <main class="helper-shell" data-state="${escapeHtml(
      isSuccess ? 'success' : isLoginRequired ? 'warning' : 'danger'
  )}">
    <p class="helper-kicker">Helper local OpenClaw</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    ${manualCode}
    <div class="helper-actions">
      ${action}
      <a class="helper-btn" href="#" onclick="window.close(); return false;">Cerrar esta ventana</a>
    </div>
  </main>
  ${autoLaunchScript}
  ${closeScript}
</body>
</html>`;
}

function sendJson(res, payload, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendHtml(res, html, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(html);
}

function createOpenClawAuthHelperServer(options = {}) {
    const config = loadHelperConfig(options);
    const resolvePath = config.helperBasePath
        ? `${config.helperBasePath}/resolve`
        : '/resolve';

    const server = http.createServer(async (req, res) => {
        const method = String(req.method || 'GET').toUpperCase();
        const url = new URL(
            req.url || '/',
            `http://${req.headers.host || '127.0.0.1'}`
        );

        if (method !== 'GET' || url.pathname !== resolvePath) {
            sendJson(
                res,
                {
                    ok: false,
                    error: 'Ruta no soportada por el helper local.',
                },
                404
            );
            return;
        }

        try {
            const context = normalizeResolveContext(url);
            const result = await resolveOperatorChallenge(context, config);
            if (prefersJsonResponse(req, url)) {
                sendJson(
                    res,
                    result,
                    result.status === 'completed' ? 200 : 202
                );
                return;
            }
            sendHtml(
                res,
                renderResolveHtml(result),
                result.status === 'completed' ? 200 : 202
            );
        } catch (error) {
            const payload = {
                ok: false,
                status: 'helper_no_disponible',
                errorCode: 'helper_no_disponible',
                error:
                    error instanceof Error
                        ? error.message
                        : 'Error desconocido del helper local.',
            };

            if (prefersJsonResponse(req, url)) {
                sendJson(res, payload, 500);
                return;
            }
            sendHtml(res, renderResolveHtml(payload), 500);
        }
    });

    return {
        server,
        config,
        resolvePath,
        listeningBaseUrl() {
            const address = server.address();
            if (!address || typeof address === 'string') {
                return trimTrailingSlash(config.helperBaseUrl);
            }
            return `http://${address.address}:${address.port}${config.helperBasePath}`;
        },
    };
}

async function startCliServer() {
    const helper = createOpenClawAuthHelperServer();
    await new Promise((resolve, reject) => {
        helper.server.once('error', reject);
        helper.server.listen(
            helper.config.helperPort,
            helper.config.helperHostname,
            resolve
        );
    });

    const listeningUrl = helper.listeningBaseUrl();
    console.log(
        `[openclaw-auth-helper] listening on ${listeningUrl}${helper.resolvePath.replace(helper.config.helperBasePath, '')}`
    );

    const shutdown = () => {
        helper.server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

if (require.main === module) {
    startCliServer().catch((error) => {
        console.error(
            error instanceof Error
                ? error.stack || error.message
                : String(error)
        );
        process.exitCode = 1;
    });
}

module.exports = {
    buildDeviceId,
    createOpenClawAuthHelperServer,
    normalizeResolveContext,
    normalizeRuntimeSession,
    operatorAuthSignaturePayload,
    resolveOperatorChallenge,
    signBridgePayload,
};
