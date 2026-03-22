#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve: resolvePath } = require('node:path');

function env(name, fallback = '') {
    const normalized = String(name || '').trim();
    const candidates = normalized.startsWith('PIELARMONIA_')
        ? [`AURORADERM_${normalized.slice('PIELARMONIA_'.length)}`, normalized]
        : [normalized];
    for (const candidate of candidates) {
        const value = process.env[candidate];
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
    }
    return fallback;
}

const DEFAULT_SERVER_BASE_URL =
    process.env.TEST_BASE_URL ||
    env('AURORADERM_OPERATOR_AUTH_SERVER_BASE_URL') ||
    'http://127.0.0.1:8011';
const DEFAULT_HELPER_BASE_URL =
    env('AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL') ||
    'http://127.0.0.1:4173';
const DEFAULT_JSON_OUT =
    'verification/operator-auth-live-smoke/operator-auth-live-smoke-last.json';
const DEFAULT_EXPECTED_MODE = 'google_oauth';
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_POLL_TIMEOUT_MS = 25000;
const DEFAULT_RETURN_TO =
    '/operador-turnos.html?station=smoke&lock=1&one_tap=1';
const DEFAULT_TRANSPORT = normalizeTransport(
    env('AURORADERM_OPERATOR_AUTH_TRANSPORT', 'local_helper')
);
const TERMINAL_STATUSES = new Set([
    'openclaw_no_logueado',
    'helper_no_disponible',
    'challenge_expirado',
    'email_no_permitido',
]);
const WEB_BROKER_TERMINAL_STATUSES = new Set([
    'cancelled',
    'invalid_state',
    'broker_unavailable',
    'code_exchange_failed',
    'identity_missing',
    'email_no_permitido',
    'operator_auth_not_configured',
]);

function trimToString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaseUrl(value) {
    return trimToString(value).replace(/\/+$/, '');
}

function normalizeTransport(value) {
    return trimToString(value).toLowerCase() === 'web_broker'
        ? 'web_broker'
        : 'local_helper';
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
        throw new Error(
            `Argumento invalido --${Array.isArray(names) ? names[0] : names}: ${raw}`
        );
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
        jar.set(
            token.slice(0, separator).trim(),
            token.slice(separator + 1).trim()
        );
    }

    for (const cookie of extractSetCookies(response)) {
        const pair = trimToString(String(cookie).split(';')[0]);
        if (pair === '' || !pair.includes('=')) {
            continue;
        }
        const separator = pair.indexOf('=');
        jar.set(
            pair.slice(0, separator).trim(),
            pair.slice(separator + 1).trim()
        );
    }

    return Array.from(jar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

function mergeCookieHeaderFromPairs(currentHeader, pairs = []) {
    const jar = new Map();
    for (const item of String(currentHeader || '').split(';')) {
        const token = trimToString(item);
        if (token === '' || !token.includes('=')) {
            continue;
        }
        const separator = token.indexOf('=');
        jar.set(
            token.slice(0, separator).trim(),
            token.slice(separator + 1).trim()
        );
    }

    for (const pair of pairs) {
        const name = trimToString(pair && pair.name);
        const value = trimToString(pair && pair.value);
        if (name === '' || value === '') {
            continue;
        }
        jar.set(name, value);
    }

    return Array.from(jar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

function cookieHeaderToBrowserCookies(cookieHeader, targetUrl) {
    if (trimToString(cookieHeader) === '') {
        return [];
    }

    const url = new URL(targetUrl);
    const secure = url.protocol === 'https:';

    return String(cookieHeader)
        .split(';')
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => {
            const separator = token.indexOf('=');
            if (separator === -1) {
                return null;
            }

            return {
                name: token.slice(0, separator).trim(),
                value: token.slice(separator + 1).trim(),
                domain: url.hostname,
                path: '/',
                httpOnly: false,
                secure,
            };
        })
        .filter(Boolean);
}

function browserCookiesToPairs(cookies = [], targetUrl) {
    let hostname = '';
    let pathname = '/';
    if (targetUrl) {
        try {
            const parsed = new URL(targetUrl);
            hostname = parsed.hostname;
            pathname = parsed.pathname || '/';
        } catch (_error) {
            hostname = '';
            pathname = '/';
        }
    }

    return (Array.isArray(cookies) ? cookies : [])
        .filter((cookie) => {
            if (!cookie || trimToString(cookie.name) === '') {
                return false;
            }

            if (!hostname) {
                return true;
            }

            const domain = trimToString(cookie.domain).replace(/^\./, '');
            if (
                domain &&
                hostname !== domain &&
                !hostname.endsWith(`.${domain}`)
            ) {
                return false;
            }

            const cookiePath = trimToString(cookie.path) || '/';
            return pathname.startsWith(cookiePath);
        })
        .map((cookie) => ({
            name: trimToString(cookie.name),
            value: trimToString(cookie.value),
        }));
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
            redirect: options.redirect || 'follow',
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
        transport: normalizeTransport(value.transport),
        error: trimToString(value.error),
        csrfTokenPresent: trimToString(value.csrfToken) !== '',
        redirectUrl: trimToString(value.redirectUrl),
        expiresAt: trimToString(value.expiresAt),
        operator:
            value.operator && typeof value.operator === 'object'
                ? {
                      email: trimToString(value.operator.email),
                      profileId: trimToString(value.operator.profileId),
                      accountId: trimToString(value.operator.accountId),
                      source: trimToString(value.operator.source),
                  }
                : null,
        challenge:
            value.challenge && typeof value.challenge === 'object'
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
        identity:
            value.identity && typeof value.identity === 'object'
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
    const pollTimeoutMs = Number(
        options.pollTimeoutMs || DEFAULT_POLL_TIMEOUT_MS
    );
    const fetchImpl = options.fetchImpl;
    const delayImpl = options.delayImpl;
    const statusUrl = `${options.serverBaseUrl}/admin-auth.php?action=status`;
    const cookieHeader = trimToString(options.cookieHeader);
    const pollAfterMs = Math.max(50, Number(options.pollAfterMs || 1200));
    let attempts = 0;

    while (Date.now() - startedAt <= pollTimeoutMs) {
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
            helper.origin === expected.origin && helper.pathname === '/resolve'
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
        transport: options.transport,
        expectedMode: options.expectedMode,
        domain: options.serverBaseUrl,
        serverBaseUrl: options.serverBaseUrl,
        helperBaseUrl: options.helperBaseUrl,
        returnTo: options.returnTo,
        requestTimeoutMs: options.requestTimeoutMs,
        pollTimeoutMs: options.pollTimeoutMs,
        redirect_url: '',
        callback_ok: null,
        shared_session_ok: null,
        logout_ok: null,
        initialStatus: null,
        helperHealth: null,
        start: null,
        resolve: null,
        brokerLogin: null,
        poll: null,
        sharedSession: null,
        finalStatus: null,
        logout: null,
        logoutStatus: null,
        error: null,
        stage: 'init',
    };
}

async function requestAuthStatus(serverBaseUrl, cookieHeader, options = {}) {
    const response = await requestJson(
        'GET',
        `${serverBaseUrl}/admin-auth.php?action=status`,
        {
            fetchImpl: options.fetchImpl,
            timeoutMs: options.requestTimeoutMs,
            headers:
                trimToString(cookieHeader) === ''
                    ? {}
                    : { Cookie: cookieHeader },
        }
    );

    return {
        response,
        payload: sanitizeStatusPayload(response.json),
    };
}

async function requestOperatorSurfaceStatus(
    serverBaseUrl,
    cookieHeader,
    options = {}
) {
    const response = await requestJson(
        'GET',
        `${serverBaseUrl}/api.php?resource=operator-auth-status`,
        {
            fetchImpl: options.fetchImpl,
            timeoutMs: options.requestTimeoutMs,
            headers:
                trimToString(cookieHeader) === ''
                    ? {}
                    : { Cookie: cookieHeader },
        }
    );

    return {
        response,
        payload: sanitizeStatusPayload(response.json),
    };
}

async function verifySharedSession(serverBaseUrl, cookieHeader, options = {}) {
    const [adminStatus, operatorStatus] = await Promise.all([
        requestAuthStatus(serverBaseUrl, cookieHeader, options),
        requestOperatorSurfaceStatus(serverBaseUrl, cookieHeader, options),
    ]);

    const adminEmail = trimToString(adminStatus.payload?.operator?.email);
    const operatorEmail = trimToString(operatorStatus.payload?.operator?.email);
    const expectedEmail = trimToString(options.expectedEmail).toLowerCase();
    const emailsMatchExpected =
        expectedEmail === '' ||
        adminEmail.toLowerCase() === expectedEmail ||
        operatorEmail.toLowerCase() === expectedEmail;

    return {
        ok:
            adminStatus.payload.authenticated === true &&
            operatorStatus.payload.authenticated === true &&
            adminStatus.payload.status === 'autenticado' &&
            operatorStatus.payload.status === 'autenticado' &&
            emailsMatchExpected,
        admin: {
            httpStatus: adminStatus.response.status,
            payload: adminStatus.payload,
        },
        operator: {
            httpStatus: operatorStatus.response.status,
            payload: operatorStatus.payload,
        },
        emailsMatchExpected,
    };
}

function normalizeBase32(secret) {
    return trimToString(secret)
        .replace(/[\s-]+/g, '')
        .toUpperCase();
}

function decodeBase32(secret) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const normalized = normalizeBase32(secret);
    if (normalized === '') {
        return Buffer.alloc(0);
    }

    let bits = '';
    for (const char of normalized) {
        const index = alphabet.indexOf(char);
        if (index === -1) {
            throw new Error('OPENCLAW_AUTH_BROKER_SMOKE_TOTP_SECRET invalido');
        }
        bits += index.toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
        bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    }

    return Buffer.from(bytes);
}

function generateTotp(secret, timestampMs = Date.now()) {
    const key = decodeBase32(secret);
    const counter = Math.floor(timestampMs / 30000);
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buffer.writeUInt32BE(counter >>> 0, 4);

    const digest = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);

    return String(binary % 1000000).padStart(6, '0');
}

async function firstVisibleLocator(page, selectors) {
    for (const selector of selectors) {
        const locator = page.locator(selector).first();
        try {
            if (await locator.isVisible({ timeout: 1500 })) {
                return locator;
            }
        } catch (_error) {
            // noop
        }
    }

    return null;
}

async function clickSubmit(page) {
    const locator = await firstVisibleLocator(page, [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Continuar")',
        'button:has-text("Entrar")',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        'button:has-text("Login")',
        'button:has-text("Next")',
    ]);

    if (!locator) {
            throw new Error(
                'No se encontro un boton submit visible en el broker OAuth.'
            );
    }

    await locator.click();
}

async function performBrokerBrowserLogin(contextOptions = {}) {
    const username = trimToString(
        contextOptions.username ||
            process.env.OPENCLAW_AUTH_BROKER_SMOKE_USERNAME
    );
    const password = trimToString(
        contextOptions.password ||
            process.env.OPENCLAW_AUTH_BROKER_SMOKE_PASSWORD
    );
    const totpSecret = trimToString(
        contextOptions.totpSecret ||
            process.env.OPENCLAW_AUTH_BROKER_SMOKE_TOTP_SECRET
    );
    const enabled =
        trimToString(
            contextOptions.enabled ||
                process.env.OPENCLAW_AUTH_BROKER_SMOKE_ENABLED
        ).toLowerCase() === 'true';

    if (!enabled) {
        return {
            ok: false,
            callbackOk: false,
            error: 'OPENCLAW_AUTH_BROKER_SMOKE_ENABLED=false; el smoke live web_broker esta deshabilitado.',
            cookies: [],
            finalUrl: '',
        };
    }

    if (username === '' || password === '') {
        return {
            ok: false,
            callbackOk: false,
            error: 'Faltan OPENCLAW_AUTH_BROKER_SMOKE_USERNAME/OPENCLAW_AUTH_BROKER_SMOKE_PASSWORD.',
            cookies: [],
            finalUrl: '',
        };
    }

    let playwrightModule;
    try {
        playwrightModule = require('playwright');
    } catch (error) {
        return {
            ok: false,
            callbackOk: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'playwright_no_disponible',
            cookies: [],
            finalUrl: '',
        };
    }

    const browser = await playwrightModule.chromium.launch({ headless: true });
    try {
        const browserContext = await browser.newContext({
            ignoreHTTPSErrors: true,
        });
        const seedCookies = cookieHeaderToBrowserCookies(
            contextOptions.cookieHeader,
            contextOptions.serverBaseUrl
        );
        if (seedCookies.length > 0) {
            await browserContext.addCookies(seedCookies);
        }

        const page = await browserContext.newPage();
        await page.goto(contextOptions.redirectUrl, {
            waitUntil: 'domcontentloaded',
            timeout: contextOptions.pollTimeoutMs,
        });

        const baseUrl = normalizeBaseUrl(contextOptions.serverBaseUrl);
        if (!String(page.url() || '').startsWith(baseUrl)) {
            const usernameField = await firstVisibleLocator(page, [
                'input[type="email"]',
                'input[autocomplete="username"]',
                'input[name*="email" i]',
                'input[id*="email" i]',
                'input[name*="user" i]',
                'input[id*="user" i]',
                'input[type="text"]',
            ]);
            if (!usernameField) {
                throw new Error(
                    'No se encontro un campo usuario/email visible en el broker OAuth.'
                );
            }

            await usernameField.fill(username);
            await clickSubmit(page);

            const passwordField = await firstVisibleLocator(page, [
                'input[type="password"]',
                'input[autocomplete="current-password"]',
                'input[name*="password" i]',
                'input[id*="password" i]',
            ]);
            if (!passwordField) {
                throw new Error(
                    'No se encontro un campo password visible en el broker OAuth.'
                );
            }

            await passwordField.fill(password);
            await clickSubmit(page);

            if (totpSecret !== '') {
                const otpField = await firstVisibleLocator(page, [
                    'input[autocomplete="one-time-code"]',
                    'input[name*="otp" i]',
                    'input[id*="otp" i]',
                    'input[name*="totp" i]',
                    'input[id*="totp" i]',
                    'input[name*="code" i]',
                    'input[id*="code" i]',
                ]);

                if (otpField) {
                    await otpField.fill(generateTotp(totpSecret));
                    await clickSubmit(page);
                }
            }
        }

        await page.waitForURL((url) => String(url || '').startsWith(baseUrl), {
            timeout: contextOptions.pollTimeoutMs,
        });

        await page.waitForLoadState('domcontentloaded', {
            timeout: contextOptions.requestTimeoutMs,
        });

        return {
            ok: true,
            callbackOk: true,
            finalUrl: page.url(),
            cookies: await browserContext.cookies(),
        };
    } finally {
        await browser.close();
    }
}

async function performWebBrokerLogin(options, context) {
    if (typeof options.performWebBrokerLogin === 'function') {
        return options.performWebBrokerLogin(context);
    }

    return performBrokerBrowserLogin(context);
}

async function runLocalHelperSmoke(options, report) {
    let cookieHeader = '';

    if (options.helperBaseUrl === '') {
        return buildFailureReport(report, 'config', 'helperBaseUrl vacio');
    }

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
        payload:
            helperHealthResponse.json &&
            typeof helperHealthResponse.json === 'object'
                ? {
                      ok: helperHealthResponse.json.ok === true,
                      service: trimToString(helperHealthResponse.json.service),
                      helperBaseUrl: trimToString(
                          helperHealthResponse.json.helperBaseUrl
                      ),
                      serverBaseUrlConfigured:
                          helperHealthResponse.json.serverBaseUrlConfigured ===
                          true,
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
        challenge: sanitizeChallenge(
            startResponse.json && startResponse.json.challenge
        ),
    };
    report.redirect_url = report.start.challenge.helperUrl || '';

    if (
        startResponse.status !== 202 ||
        report.start.payload.status !== 'pending'
    ) {
        return buildFailureReport(
            report,
            'start',
            'admin-auth.php?action=start no devolvio challenge pending',
            {
                httpStatus: startResponse.status,
                status: report.start.payload.status,
            }
        );
    }

    if (
        !ensureHelperUrl(
            report.start.challenge.helperUrl,
            options.helperBaseUrl
        )
    ) {
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
            report.resolve.payload.error ||
                'El helper no pudo aceptar el challenge',
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
    report.callback_ok = pollResult.ok === true;

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
        report.logout_ok =
            logoutResponse.status === 200 &&
            report.logout.payload.status === 'logout';

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
}

async function runWebBrokerSmoke(options, report) {
    let cookieHeader = '';

    const initialStatus = await requestAuthStatus(
        options.serverBaseUrl,
        cookieHeader,
        options
    );
    report.initialStatus = {
        httpStatus: initialStatus.response.status,
        payload: initialStatus.payload,
    };

    if (initialStatus.response.status !== 200) {
        return buildFailureReport(
            report,
            'initial_status',
            'admin-auth.php?action=status no respondio 200',
            { httpStatus: initialStatus.response.status }
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

    const startResponse = await requestJson(
        'POST',
        `${options.serverBaseUrl}/admin-auth.php?action=start`,
        {
            fetchImpl: options.fetchImpl,
            timeoutMs: options.requestTimeoutMs,
            body: {
                returnTo: options.returnTo,
            },
        }
    );
    cookieHeader = mergeCookieHeader(cookieHeader, startResponse.response);
    report.start = {
        httpStatus: startResponse.status,
        payload: sanitizeStatusPayload(startResponse.json),
    };
    report.redirect_url = trimToString(report.start.payload.redirectUrl);

    if (
        startResponse.status !== 202 ||
        report.start.payload.status !== 'pending' ||
        report.start.payload.transport !== 'web_broker' ||
        report.redirect_url === ''
    ) {
        return buildFailureReport(
            report,
            'start',
            'admin-auth.php?action=start no devolvio redirectUrl pending de web_broker',
            {
                httpStatus: startResponse.status,
                status: report.start.payload.status,
                transport: report.start.payload.transport,
            }
        );
    }

    if (options.preflightOnly) {
        return finalizeReport(report, {
            ok: true,
            stage: 'preflight',
        });
    }

    const brokerResult = await performWebBrokerLogin(options, {
        cookieHeader,
        redirectUrl: report.redirect_url,
        expiresAt: report.start.payload.expiresAt,
        serverBaseUrl: options.serverBaseUrl,
        requestTimeoutMs: options.requestTimeoutMs,
        pollTimeoutMs: options.pollTimeoutMs,
        returnTo: options.returnTo,
        expectedEmail: options.expectedEmail,
    });

    report.brokerLogin = {
        ok: brokerResult && brokerResult.ok === true,
        callbackOk: brokerResult && brokerResult.callbackOk === true,
        finalUrl: trimToString(brokerResult && brokerResult.finalUrl),
        error: trimToString(brokerResult && brokerResult.error),
    };
    report.callback_ok = report.brokerLogin.callbackOk === true;

    if (!report.brokerLogin.ok) {
        return buildFailureReport(
            report,
            'broker_login',
            report.brokerLogin.error ||
                'No se pudo completar el login en el broker OAuth.'
        );
    }

    if (trimToString(brokerResult && brokerResult.cookieHeader) !== '') {
        cookieHeader = mergeCookieHeaderFromPairs(cookieHeader, []);
        cookieHeader = trimToString(brokerResult.cookieHeader);
    } else if (Array.isArray(brokerResult && brokerResult.cookies)) {
        cookieHeader = mergeCookieHeaderFromPairs(
            cookieHeader,
            browserCookiesToPairs(brokerResult.cookies, options.serverBaseUrl)
        );
    }

    const finalStatus = await requestAuthStatus(
        options.serverBaseUrl,
        cookieHeader,
        options
    );
    report.finalStatus = finalStatus.payload;

    if (finalStatus.response.status !== 200) {
        return buildFailureReport(
            report,
            'callback_status',
            'No se pudo verificar el estado final despues del callback.',
            { httpStatus: finalStatus.response.status }
        );
    }

    if (
        report.finalStatus.authenticated !== true ||
        report.finalStatus.status !== 'autenticado'
    ) {
        if (WEB_BROKER_TERMINAL_STATUSES.has(report.finalStatus.status)) {
            return buildFailureReport(
                report,
                'callback_status',
                report.finalStatus.error ||
                    `Operator auth devolvio estado terminal ${report.finalStatus.status}.`,
                {
                    status: report.finalStatus.status,
                }
            );
        }

        return buildFailureReport(
            report,
            'callback_status',
            'El callback no termino con sesion autenticada.',
            {
                status: report.finalStatus.status,
            }
        );
    }

    const sharedSession = await verifySharedSession(
        options.serverBaseUrl,
        cookieHeader,
        options
    );
    report.sharedSession = sharedSession;
    report.shared_session_ok = sharedSession.ok === true;

    if (!sharedSession.ok) {
        return buildFailureReport(
            report,
            'shared_session',
            'Admin y operator-auth-status no comparten la misma sesion autenticada.'
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

        const logoutStatus = await verifySharedSession(
            options.serverBaseUrl,
            cookieHeader,
            {
                ...options,
                expectedEmail: '',
            }
        );
        report.logoutStatus = logoutStatus;
        report.logout_ok =
            logoutStatus.admin.payload.authenticated === false &&
            logoutStatus.operator.payload.authenticated === false &&
            logoutStatus.admin.payload.status === 'anonymous' &&
            logoutStatus.operator.payload.status === 'anonymous';

        if (!report.logout_ok) {
            return buildFailureReport(
                report,
                'logout',
                'Logout no invalido ambas superficies de sesion.'
            );
        }
    }

    return finalizeReport(report, {
        ok: true,
        stage: options.noLogout ? 'authenticated' : 'logout',
    });
}

async function runSmoke(inputOptions = {}) {
    const options = {
        fetchImpl: inputOptions.fetchImpl,
        delayImpl: inputOptions.delayImpl,
        performWebBrokerLogin: inputOptions.performWebBrokerLogin,
        preflightOnly: inputOptions.preflightOnly === true,
        noLogout: inputOptions.noLogout === true,
        transport: normalizeTransport(
            inputOptions.transport || DEFAULT_TRANSPORT
        ),
        expectedMode:
            trimToString(inputOptions.expectedMode) || DEFAULT_EXPECTED_MODE,
        serverBaseUrl: normalizeBaseUrl(
            inputOptions.serverBaseUrl || DEFAULT_SERVER_BASE_URL
        ),
        helperBaseUrl: normalizeBaseUrl(
            inputOptions.helperBaseUrl || DEFAULT_HELPER_BASE_URL
        ),
        requestTimeoutMs: Number(
            inputOptions.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
        ),
        pollTimeoutMs: Number(
            inputOptions.pollTimeoutMs || DEFAULT_POLL_TIMEOUT_MS
        ),
        returnTo: trimToString(inputOptions.returnTo) || DEFAULT_RETURN_TO,
        expectedEmail: trimToString(
            inputOptions.expectedEmail ||
                process.env.OPENCLAW_AUTH_BROKER_SMOKE_EXPECTED_EMAIL
        ).toLowerCase(),
    };

    const report = createInitialReport(options);

    if (options.serverBaseUrl === '') {
        return buildFailureReport(report, 'config', 'serverBaseUrl vacio');
    }

    try {
        if (options.transport === 'web_broker') {
            return await runWebBrokerSmoke(options, report);
        }

        return await runLocalHelperSmoke(options, report);
    } catch (error) {
        return buildFailureReport(
            report,
            'exception',
            trimToString(error && error.message) ||
                'Error inesperado durante el smoke'
        );
    }
}

function parseCliArgs(argv = process.argv.slice(2)) {
    return {
        help: hasFlag(argv, ['help', 'h']),
        preflightOnly: hasFlag(argv, 'preflight-only'),
        noLogout: hasFlag(argv, 'no-logout'),
        transport: parseStringArg(argv, ['transport'], DEFAULT_TRANSPORT),
        returnTo: parseStringArg(
            argv,
            ['return-to', 'returnTo'],
            DEFAULT_RETURN_TO
        ),
        serverBaseUrl: parseStringArg(
            argv,
            ['server-base-url', 'serverBaseUrl'],
            ''
        ),
        helperBaseUrl: parseStringArg(
            argv,
            ['helper-base-url', 'helperBaseUrl'],
            ''
        ),
        expectedMode: parseStringArg(
            argv,
            ['expected-mode', 'expectedMode'],
            ''
        ),
        expectedEmail: parseStringArg(
            argv,
            ['expected-email', 'expectedEmail'],
            ''
        ),
        jsonOut: parseStringArg(
            argv,
            ['json-out', 'jsonOut'],
            DEFAULT_JSON_OUT
        ),
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
            `  --transport=MODE           local_helper|web_broker (default ${DEFAULT_TRANSPORT})`,
            `  --server-base-url=URL      Backend PHP (default ${DEFAULT_SERVER_BASE_URL})`,
            `  --helper-base-url=URL      Helper local (default ${DEFAULT_HELPER_BASE_URL})`,
            `  --return-to=PATH           ReturnTo para web_broker (default ${DEFAULT_RETURN_TO})`,
            `  --expected-mode=MODE       Modo esperado (default ${DEFAULT_EXPECTED_MODE})`,
            '  --expected-email=EMAIL     Email esperado para el smoke web_broker',
            `  --request-timeout-ms=N     Timeout por request (default ${DEFAULT_REQUEST_TIMEOUT_MS})`,
            `  --poll-timeout-ms=N        Timeout total del flujo (default ${DEFAULT_POLL_TIMEOUT_MS})`,
            '  --preflight-only           Solo valida surfaces y start del flujo',
            '  --no-logout                Deja la sesion abierta si autentica',
            `  --json-out=PATH            Reporte JSON (default ${DEFAULT_JSON_OUT})`,
            '  --help                     Muestra esta ayuda',
            '',
            'Env web_broker:',
            '  OPENCLAW_AUTH_BROKER_SMOKE_ENABLED=true',
            '  OPENCLAW_AUTH_BROKER_SMOKE_USERNAME=...',
            '  OPENCLAW_AUTH_BROKER_SMOKE_PASSWORD=...',
            '  OPENCLAW_AUTH_BROKER_SMOKE_TOTP_SECRET=... (opcional)',
            '  OPENCLAW_AUTH_BROKER_SMOKE_EXPECTED_EMAIL=...',
        ].join('\n') + '\n'
    );
}

function writeJsonReport(pathname, payload) {
    const absolutePath = resolvePath(pathname);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(
        absolutePath,
        `${JSON.stringify(payload, null, 2)}\n`,
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
        transport: parsed.transport,
        returnTo: parsed.returnTo,
        serverBaseUrl: parsed.serverBaseUrl || DEFAULT_SERVER_BASE_URL,
        helperBaseUrl: parsed.helperBaseUrl || DEFAULT_HELPER_BASE_URL,
        expectedMode: parsed.expectedMode || DEFAULT_EXPECTED_MODE,
        expectedEmail: parsed.expectedEmail,
        requestTimeoutMs: parsed.requestTimeoutMs,
        pollTimeoutMs: parsed.pollTimeoutMs,
    });

    const jsonOut = trimToString(parsed.jsonOut);
    const reportPath = jsonOut === '' ? '' : writeJsonReport(jsonOut, report);

    process.stdout.write(
        `${JSON.stringify(reportPath === '' ? report : { ...report, reportPath }, null, 2)}\n`
    );

    return report.ok ? 0 : 1;
}

module.exports = {
    DEFAULT_EXPECTED_MODE,
    DEFAULT_HELPER_BASE_URL,
    DEFAULT_JSON_OUT,
    DEFAULT_POLL_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    DEFAULT_RETURN_TO,
    DEFAULT_SERVER_BASE_URL,
    DEFAULT_TRANSPORT,
    TERMINAL_STATUSES,
    WEB_BROKER_TERMINAL_STATUSES,
    browserCookiesToPairs,
    cookieHeaderToBrowserCookies,
    generateTotp,
    mergeCookieHeader,
    mergeCookieHeaderFromPairs,
    normalizeBaseUrl,
    normalizeTransport,
    parseCliArgs,
    pollAuthStatus,
    requestJson,
    runCli,
    runSmoke,
    sanitizeChallenge,
    sanitizeResolvePayload,
    sanitizeStatusPayload,
    verifySharedSession,
};

if (require.main === module) {
    runCli()
        .then((code) => {
            process.exit(code);
        })
        .catch((error) => {
            process.stderr.write(
                `[operator-auth-live-smoke] ${
                    error && error.message ? error.message : String(error)
                }\n`
            );
            process.exit(1);
        });
}
