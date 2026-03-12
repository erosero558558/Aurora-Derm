#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve: resolvePath } = require('node:path');

const DEFAULT_SERVER_BASE_URL =
    process.env.TEST_BASE_URL ||
    process.env.PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL ||
    'http://127.0.0.1:8011';
const DEFAULT_HELPER_BASE_URL =
    process.env.PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL ||
    'http://127.0.0.1:4173';
const DEFAULT_JSON_OUT =
    'verification/operator-auth-live-smoke/operator-auth-live-smoke-last.json';
const DEFAULT_EXPECTED_MODE = 'openclaw_chatgpt';
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_POLL_TIMEOUT_MS = 25000;
const TERMINAL_STATUSES = new Set([
    'openclaw_no_logueado',
    'helper_no_disponible',
    'challenge_expirado',
    'email_no_permitido',
]);

function trimToString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaseUrl(value) {
    return trimToString(value).replace(/\/+$/, '');
}

function parseStringArg(argv, names, fallback = '') {
    const normalizedNames = Array.isArray(names) ? names : [names];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = trimToString(argv[index]);
        for (const name of normalizedNames) {
            const prefixed = `--${name}=`;
            if (arg === `--${name}`) {
                const next = trimToString(argv[index + 1]);
                return next === '' ? fallback : next;
            }
            if (arg.startsWith(prefixed)) {
                const raw = trimToString(arg.slice(prefixed.length));
                return raw === '' ? fallback : raw;
            }
        }
    }

    return fallback;
}

function parseIntArg(argv, names, fallback, minValue = 0) {
    const raw = parseStringArg(argv, names, '');
    if (raw === '') {
        return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < minValue) {
        throw new Error(`Argumento invalido --${Array.isArray(names) ? names[0] : names}: ${raw}`);
    }

    return parsed;
}

function hasFlag(argv, names) {
    const normalizedNames = Array.isArray(names) ? names : [names];
    return argv.some((arg) =>
        normalizedNames.some((name) => trimToString(arg) === `--${name}`)
    );
}

function splitSetCookieHeader(rawValue) {
    if (!rawValue) {
        return [];
    }

    return String(rawValue)
        .split(/,(?=[^;,]+=[^;,]+)/g)
        .map((item) => item.trim())
        .filter(Boolean);
}

function extractSetCookies(response) {
    if (!response || !response.headers) {
        return [];
    }

    if (typeof response.headers.getSetCookie === 'function') {
        const cookies = response.headers.getSetCookie();
        return Array.isArray(cookies) ? cookies : [];
    }

    const raw = response.headers.get('set-cookie');
    return splitSetCookieHeader(raw);
}

function mergeCookieHeader(currentHeader, response) {
    const jar = new Map();
    for (const item of String(currentHeader || '').split(';')) {
        const token = trimToString(item);
        if (token === '' || !token.includes('=')) {
            continue;
        }
        const separator = token.indexOf('=');
        jar.set(token.slice(0, separator).trim(), token.slice(separator + 1).trim());
    }

    for (const cookie of extractSetCookies(response)) {
        const pair = trimToString(String(cookie).split(';')[0]);
        if (pair === '' || !pair.includes('=')) {
            continue;
        }
        const separator = pair.indexOf('=');
        jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }

    return Array.from(jar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

async function requestJson(method, url, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const timeoutMs = Number(options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
    };

    let body;
    if (options.body !== undefined) {
        body = JSON.stringify(options.body);
        if (!Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
            headers['Content-Type'] = 'application/json';
        }
    }

    try {
        const response = await fetchImpl(url, {
            method,
            headers,
            body,
            signal: controller.signal,
        });

        const text = await response.text();
        let json = null;
        if (text !== '') {
            try {
                json = JSON.parse(text);
            } catch (_error) {
                json = null;
            }
        }

        return {
            ok: response.ok,
            status: Number(response.status || 0),
            json,
            text,
            headers: response.headers,
            response,
            url,
        };
    } finally {
        clearTimeout(timer);
    }
}

function delay(ms, delayImpl = setTimeout) {
    return new Promise((resolve) => delayImpl(resolve, ms));
}

function sanitizeChallenge(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }

    return {
        challengeId: trimToString(value.challengeId),
        nonce: trimToString(value.nonce),
        status: trimToString(value.status),
        manualCode: trimToString(value.manualCode),
        helperUrl: trimToString(value.helperUrl),
        expiresAt: trimToString(value.expiresAt),
        pollAfterMs: Number(value.pollAfterMs || 0),
    };
}

function sanitizeStatusPayload(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }

    return {
        ok: value.ok === true,
        authenticated: value.authenticated === true,
        status: trimToString(value.status),
        mode: trimToString(value.mode),
        error: trimToString(value.error),
        csrfTokenPresent: trimToString(value.csrfToken) !== '',
        operator: value.operator && typeof value.operator === 'object'
            ? {
                  email: trimToString(value.operator.email),
                  profileId: trimToString(value.operator.profileId),
                  accountId: trimToString(value.operator.accountId),
                  source: trimToString(value.operator.source),
              }
            : null,
        challenge: value.challenge && typeof value.challenge === 'object'
            ? sanitizeChallenge(value.challenge)
            : null,
    };
}

function sanitizeResolvePayload(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }

    return {
        ok: value.ok === true,
        accepted: value.accepted === true,
        status: trimToString(value.status),
        error: trimToString(value.error),
        identity: value.identity && typeof value.identity === 'object'
            ? {
                  email: trimToString(value.identity.email),
                  profileId: trimToString(value.identity.profileId),
                  accountId: trimToString(value.identity.accountId),
              }
            : null,
    };
}

function finalizeReport(report, overrides = {}) {
    return {
        ...report,
        ...overrides,
        finishedAt: new Date().toISOString(),
    };
}

function buildFailureReport(report, stage, message, extra = {}) {
    return finalizeReport(report, {
        ok: false,
        stage,
        error: {
            stage,
            message,
            ...extra,
        },
    });
}

async function pollAuthStatus(options) {
    const startedAt = Date.now();
    const pollTimeoutMs = Number(options.pollTimeoutMs || DEFAULT_POLL_TIMEOUT_MS);
    const fetchImpl = options.fetchImpl;
    const delayImpl = options.delayImpl;
    const statusUrl = `${options.serverBaseUrl}/admin-auth.php?action=status`;
    const cookieHeader = trimToString(options.cookieHeader);
    const pollAfterMs = Math.max(50, Number(options.pollAfterMs || 1200));
    let attempts = 0;

    while ((Date.now() - startedAt) <= pollTimeoutMs) {
        attempts += 1;
        const response = await requestJson('GET', statusUrl, {
            fetchImpl,
            timeoutMs: options.requestTimeoutMs,
            headers: cookieHeader === '' ? {} : { Cookie: cookieHeader },
        });
        const payload = sanitizeStatusPayload(response.json);
        const status = trimToString(payload.status);

        if (payload.authenticated === true && status === 'autenticado') {
            return {
                ok: true,
                attempts,
                elapsedMs: Date.now() - startedAt,
                httpStatus: response.status,
                payload,
            };
        }

        if (TERMINAL_STATUSES.has(status)) {
            return {
                ok: false,
                attempts,
                elapsedMs: Date.now() - startedAt,
                httpStatus: response.status,
                payload,
                terminal: true,
            };
        }

        if (status !== 'pending') {
            return {
                ok: false,
                attempts,
                elapsedMs: Date.now() - startedAt,
                httpStatus: response.status,
                payload,
                terminal: false,
            };
        }

        await delay(pollAfterMs, delayImpl);
    }

    return {
        ok: false,
        attempts,
        elapsedMs: Date.now() - startedAt,
        payload: null,
        timedOut: true,
    };
}

function ensureHelperUrl(helperUrl, helperBaseUrl) {
    try {
        const helper = new URL(helperUrl);
        const expected = new URL(helperBaseUrl);
        return (
            helper.origin === expected.origin &&
            helper.pathname === '/resolve'
        );
    } catch (_error) {
        return false;
    }
}

function createInitialReport(options) {
    return {
        generatedAt: new Date().toISOString(),
        ok: false,
        mode: options.preflightOnly ? 'preflight' : 'full',
        expectedMode: options.expectedMode,
        serverBaseUrl: options.serverBaseUrl,
        helperBaseUrl: options.helperBaseUrl,
        requestTimeoutMs: options.requestTimeoutMs,
        pollTimeoutMs: options.pollTimeoutMs,
        initialStatus: null,
        helperHealth: null,
        start: null,
        resolve: null,
        poll: null,
        finalStatus: null,
        logout: null,
        error: null,
        stage: 'init',
    };
}

async function runSmoke(inputOptions = {}) {
    const options = {
        fetchImpl: inputOptions.fetchImpl,
        delayImpl: inputOptions.delayImpl,
        preflightOnly: inputOptions.preflightOnly === true,
        noLogout: inputOptions.noLogout === true,
        expectedMode: trimToString(inputOptions.expectedMode) || DEFAULT_EXPECTED_MODE,
        serverBaseUrl: normalizeBaseUrl(inputOptions.serverBaseUrl || DEFAULT_SERVER_BASE_URL),
        helperBaseUrl: normalizeBaseUrl(inputOptions.helperBaseUrl || DEFAULT_HELPER_BASE_URL),
        requestTimeoutMs: Number(inputOptions.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS),
        pollTimeoutMs: Number(inputOptions.pollTimeoutMs || DEFAULT_POLL_TIMEOUT_MS),
    };

    let report = createInitialReport(options);
    let cookieHeader = '';

    if (options.serverBaseUrl === '') {
        return buildFailureReport(report, 'config', 'serverBaseUrl vacio');
    }

    if (options.helperBaseUrl === '') {
        return buildFailureReport(report, 'config', 'helperBaseUrl vacio');
    }

    try {
        const initialStatusResponse = await requestJson(
            'GET',
            `${options.serverBaseUrl}/admin-auth.php?action=status`,
            {
                fetchImpl: options.fetchImpl,
                timeoutMs: options.requestTimeoutMs,
            }
        );
        report.initialStatus = {
            httpStatus: initialStatusResponse.status,
            payload: sanitizeStatusPayload(initialStatusResponse.json),
        };

        if (initialStatusResponse.status !== 200) {
            return buildFailureReport(
                report,
                'initial_status',
                'admin-auth.php?action=status no respondio 200',
                { httpStatus: initialStatusResponse.status }
            );
        }

        if (report.initialStatus.payload.mode !== options.expectedMode) {
            return buildFailureReport(
                report,
                'initial_status',
                `Modo inesperado: ${report.initialStatus.payload.mode || '(vacio)'}`,
                { expectedMode: options.expectedMode }
            );
        }

        const helperHealthResponse = await requestJson(
            'GET',
            `${options.helperBaseUrl}/health`,
            {
                fetchImpl: options.fetchImpl,
                timeoutMs: options.requestTimeoutMs,
            }
        );
        report.helperHealth = {
            httpStatus: helperHealthResponse.status,
            payload: helperHealthResponse.json && typeof helperHealthResponse.json === 'object'
                ? {
                      ok: helperHealthResponse.json.ok === true,
                      service: trimToString(helperHealthResponse.json.service),
                      helperBaseUrl: trimToString(helperHealthResponse.json.helperBaseUrl),
                      serverBaseUrlConfigured:
                          helperHealthResponse.json.serverBaseUrlConfigured === true,
                  }
                : {},
        };

        if (
            helperHealthResponse.status !== 200 ||
            report.helperHealth.payload.service !== 'operator-auth-bridge'
        ) {
            return buildFailureReport(
                report,
                'helper_health',
                'El helper local no esta sano o no expone operator-auth-bridge',
                { httpStatus: helperHealthResponse.status }
            );
        }

        const startResponse = await requestJson(
            'POST',
            `${options.serverBaseUrl}/admin-auth.php?action=start`,
            {
                fetchImpl: options.fetchImpl,
                timeoutMs: options.requestTimeoutMs,
                body: {},
            }
        );
        cookieHeader = mergeCookieHeader(cookieHeader, startResponse.response);
        report.start = {
            httpStatus: startResponse.status,
            payload: sanitizeStatusPayload(startResponse.json),
            challenge: sanitizeChallenge(startResponse.json && startResponse.json.challenge),
        };

        if (startResponse.status !== 202 || report.start.payload.status !== 'pending') {
            return buildFailureReport(
                report,
                'start',
                'admin-auth.php?action=start no devolvio challenge pending',
                { httpStatus: startResponse.status, status: report.start.payload.status }
            );
        }

        if (!ensureHelperUrl(report.start.challenge.helperUrl, options.helperBaseUrl)) {
            return buildFailureReport(
                report,
                'start',
                'El helperUrl devuelto por el backend no apunta al helper esperado',
                {
                    helperUrl: report.start.challenge.helperUrl,
                    expectedHelperBaseUrl: options.helperBaseUrl,
                }
            );
        }

        if (options.preflightOnly) {
            return finalizeReport(report, {
                ok: true,
                stage: 'preflight',
            });
        }

        const helperResolveUrl = new URL(report.start.challenge.helperUrl);
        helperResolveUrl.searchParams.set('format', 'json');

        const resolveResponse = await requestJson(
            'GET',
            helperResolveUrl.toString(),
            {
                fetchImpl: options.fetchImpl,
                timeoutMs: options.requestTimeoutMs,
            }
        );
        report.resolve = {
            httpStatus: resolveResponse.status,
            payload: sanitizeResolvePayload(resolveResponse.json),
        };

        if (
            !report.resolve.payload.ok &&
            report.resolve.payload.accepted !== true
        ) {
            return buildFailureReport(
                report,
                'resolve',
                report.resolve.payload.error || 'El helper no pudo aceptar el challenge',
                {
                    httpStatus: resolveResponse.status,
                    status: report.resolve.payload.status,
                }
            );
        }

        const pollResult = await pollAuthStatus({
            serverBaseUrl: options.serverBaseUrl,
            cookieHeader,
            pollAfterMs: report.start.challenge.pollAfterMs,
            pollTimeoutMs: options.pollTimeoutMs,
            requestTimeoutMs: options.requestTimeoutMs,
            fetchImpl: options.fetchImpl,
            delayImpl: options.delayImpl,
        });

        report.poll = {
            ok: pollResult.ok === true,
            attempts: Number(pollResult.attempts || 0),
            elapsedMs: Number(pollResult.elapsedMs || 0),
            terminal: pollResult.terminal === true,
            timedOut: pollResult.timedOut === true,
            httpStatus: Number(pollResult.httpStatus || 0),
        };
        report.finalStatus = pollResult.payload || {};

        if (!pollResult.ok) {
            if (pollResult.timedOut) {
                return buildFailureReport(
                    report,
                    'poll',
                    'La sesion no paso a autenticado dentro del tiempo esperado'
                );
            }

            return buildFailureReport(
                report,
                'poll',
                report.finalStatus.error ||
                    `Estado final inesperado: ${report.finalStatus.status || '(vacio)'}`,
                {
                    status: report.finalStatus.status,
                }
            );
        }

        if (!options.noLogout) {
            const logoutResponse = await requestJson(
                'POST',
                `${options.serverBaseUrl}/admin-auth.php?action=logout`,
                {
                    fetchImpl: options.fetchImpl,
                    timeoutMs: options.requestTimeoutMs,
                    body: {},
                    headers: cookieHeader === '' ? {} : { Cookie: cookieHeader },
                }
            );
            cookieHeader = mergeCookieHeader(cookieHeader, logoutResponse.response);
            report.logout = {
                httpStatus: logoutResponse.status,
                payload: sanitizeStatusPayload(logoutResponse.json),
            };

            if (logoutResponse.status !== 200) {
                return buildFailureReport(
                    report,
                    'logout',
                    'admin-auth.php?action=logout no respondio 200',
                    { httpStatus: logoutResponse.status }
                );
            }
        }

        return finalizeReport(report, {
            ok: true,
            stage: options.noLogout ? 'authenticated' : 'logout',
        });
    } catch (error) {
        return buildFailureReport(
            report,
            'exception',
            trimToString(error && error.message) || 'Error inesperado durante el smoke'
        );
    }
}

function parseCliArgs(argv = process.argv.slice(2)) {
    return {
        help: hasFlag(argv, ['help', 'h']),
        preflightOnly: hasFlag(argv, 'preflight-only'),
        noLogout: hasFlag(argv, 'no-logout'),
        serverBaseUrl: parseStringArg(argv, ['server-base-url', 'serverBaseUrl'], ''),
        helperBaseUrl: parseStringArg(argv, ['helper-base-url', 'helperBaseUrl'], ''),
        expectedMode: parseStringArg(argv, ['expected-mode', 'expectedMode'], ''),
        jsonOut: parseStringArg(argv, ['json-out', 'jsonOut'], DEFAULT_JSON_OUT),
        requestTimeoutMs: parseIntArg(
            argv,
            ['request-timeout-ms', 'requestTimeoutMs'],
            DEFAULT_REQUEST_TIMEOUT_MS,
            100
        ),
        pollTimeoutMs: parseIntArg(
            argv,
            ['poll-timeout-ms', 'pollTimeoutMs'],
            DEFAULT_POLL_TIMEOUT_MS,
            100
        ),
    };
}

function printHelp() {
    process.stdout.write(
        [
            'Uso:',
            '  node bin/operator-auth-live-smoke.js [opciones]',
            '',
            'Opciones:',
            `  --server-base-url=URL      Backend PHP (default ${DEFAULT_SERVER_BASE_URL})`,
            `  --helper-base-url=URL      Helper OpenClaw (default ${DEFAULT_HELPER_BASE_URL})`,
            `  --expected-mode=MODE       Modo esperado (default ${DEFAULT_EXPECTED_MODE})`,
            `  --request-timeout-ms=N     Timeout por request (default ${DEFAULT_REQUEST_TIMEOUT_MS})`,
            `  --poll-timeout-ms=N        Timeout total del polling (default ${DEFAULT_POLL_TIMEOUT_MS})`,
            '  --preflight-only           Solo valida status + health + start challenge',
            '  --no-logout                Deja la sesion abierta si autentica',
            `  --json-out=PATH            Reporte JSON (default ${DEFAULT_JSON_OUT})`,
            '  --help                     Muestra esta ayuda',
        ].join('\n') + '\n'
    );
}

function writeJsonReport(pathname, payload) {
    const absolutePath = resolvePath(pathname);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(
        absolutePath,
        JSON.stringify(payload, null, 2) + '\n',
        'utf8'
    );
    return absolutePath;
}

async function runCli(argv = process.argv.slice(2)) {
    const parsed = parseCliArgs(argv);
    if (parsed.help) {
        printHelp();
        return 0;
    }

    const report = await runSmoke({
        preflightOnly: parsed.preflightOnly,
        noLogout: parsed.noLogout,
        serverBaseUrl: parsed.serverBaseUrl || DEFAULT_SERVER_BASE_URL,
        helperBaseUrl: parsed.helperBaseUrl || DEFAULT_HELPER_BASE_URL,
        expectedMode: parsed.expectedMode || DEFAULT_EXPECTED_MODE,
        requestTimeoutMs: parsed.requestTimeoutMs,
        pollTimeoutMs: parsed.pollTimeoutMs,
    });

    const jsonOut = trimToString(parsed.jsonOut);
    const reportPath = jsonOut === '' ? '' : writeJsonReport(jsonOut, report);

    process.stdout.write(
        JSON.stringify(
            reportPath === ''
                ? report
                : { ...report, reportPath },
            null,
            2
        ) + '\n'
    );

    return report.ok ? 0 : 1;
}

module.exports = {
    DEFAULT_EXPECTED_MODE,
    DEFAULT_HELPER_BASE_URL,
    DEFAULT_JSON_OUT,
    DEFAULT_POLL_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    DEFAULT_SERVER_BASE_URL,
    TERMINAL_STATUSES,
    mergeCookieHeader,
    normalizeBaseUrl,
    parseCliArgs,
    pollAuthStatus,
    requestJson,
    runCli,
    runSmoke,
    sanitizeChallenge,
    sanitizeResolvePayload,
    sanitizeStatusPayload,
};

if (require.main === module) {
    runCli()
        .then((code) => {
            process.exit(code);
        })
        .catch((error) => {
            process.stderr.write(
                `[operator-auth-live-smoke] ${error && error.message ? error.message : String(error)}\n`
            );
            process.exit(1);
        });
}
