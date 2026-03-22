#!/usr/bin/env node
'use strict';

const { resolveOperatorChallenge } = require('../openclaw-auth-helper.js');
const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';
const LEGACY_OPERATOR_AUTH_MODE = 'openclaw_chatgpt';

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (normalized) {
            return normalized;
        }
    }

    return '';
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

function extractCookieHeader(response) {
    let setCookies = [];
    if (response && response.headers) {
        if (typeof response.headers.getSetCookie === 'function') {
            setCookies = response.headers.getSetCookie();
        } else {
            const raw = response.headers.get('set-cookie');
            setCookies = splitSetCookieHeader(raw);
        }
    }

    if (!Array.isArray(setCookies) || setCookies.length === 0) {
        return '';
    }

    return setCookies
        .map((cookie) => String(cookie).split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
}

function createCookieJar() {
    const store = new Map();

    function applySetCookie(headerValue) {
        const raw = String(headerValue || '').trim();
        if (!raw) {
            return;
        }

        const firstPart = raw.split(';', 1)[0] || '';
        const separator = firstPart.indexOf('=');
        if (separator <= 0) {
            return;
        }

        const name = firstPart.slice(0, separator).trim();
        const value = firstPart.slice(separator + 1).trim();
        if (!name) {
            return;
        }

        if (value === '') {
            store.delete(name);
            return;
        }

        store.set(name, value);
    }

    return {
        header() {
            if (store.size === 0) {
                return '';
            }

            return Array.from(store.entries())
                .map(([name, value]) => `${name}=${value}`)
                .join('; ');
        },
        absorb(headers) {
            if (!headers) {
                return;
            }

            if (typeof headers.getSetCookie === 'function') {
                headers.getSetCookie().forEach(applySetCookie);
                return;
            }

            const single = headers.get('set-cookie');
            if (single) {
                splitSetCookieHeader(single).forEach(applySetCookie);
            }
        },
    };
}

async function requestJson(baseUrl, method, path, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 20000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = Object.assign(
        {
            Accept: 'application/json',
        },
        options.headers || {}
    );

    const cookieJar = options.cookieJar || null;
    if (cookieJar) {
        const cookieHeader = cookieJar.header();
        if (cookieHeader) {
            headers.Cookie = cookieHeader;
        }
    }

    let body;
    if (options.body !== undefined) {
        body = JSON.stringify(options.body);
        if (!Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
            headers['Content-Type'] = 'application/json';
        }
    }

    const url = path.startsWith('http')
        ? path
        : `${trimTrailingSlash(baseUrl)}${path.startsWith('/') ? '' : '/'}${path}`;
    let response;
    try {
        response = await fetch(url, {
            method,
            headers,
            body,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (cookieJar) {
        cookieJar.absorb(response.headers);
    }

    const rawText = await response.text();
    let json = null;
    if (rawText) {
        try {
            json = JSON.parse(rawText);
        } catch (_error) {
            json = null;
        }
    }

    return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        json,
        text: rawText,
        headers: response.headers,
        cookieHeader: extractCookieHeader(response),
        url,
    };
}

async function fetchAdminAuthStatus(baseUrl, options = {}) {
    return requestJson(
        baseUrl,
        'GET',
        '/admin-auth.php?action=status',
        options
    );
}

async function startAdminAuthChallenge(baseUrl, options = {}) {
    return requestJson(baseUrl, 'POST', '/admin-auth.php?action=start', {
        ...options,
        body: {},
    });
}

async function logoutAdmin(baseUrl, options = {}) {
    return requestJson(baseUrl, 'POST', '/admin-auth.php?action=logout', {
        ...options,
        body: {},
    });
}

function normalizeAuthStatusPayload(response) {
    const body =
        response && typeof response.json === 'object' && response.json
            ? response.json
            : {};

    return {
        ok: response.ok === true,
        httpStatus: Number(response.status || 0),
        body,
        mode: typeof body.mode === 'string' ? body.mode : '',
        status: typeof body.status === 'string' ? body.status : '',
        configured: body.configured !== false,
        recommendedMode:
            typeof body.recommendedMode === 'string'
                ? body.recommendedMode
                : '',
        authenticated: body.authenticated === true,
    };
}

async function loginWithLegacyPassword(baseUrl, password, options = {}) {
    const statusResponse = await fetchAdminAuthStatus(baseUrl, options);
    const status = normalizeAuthStatusPayload(statusResponse);
    if (status.mode !== 'legacy_password') {
        const preferred =
            status.mode || status.recommendedMode || 'openclaw_chatgpt';
        throw new Error(
            `Legacy admin login deshabilitado en ${preferred}. Activa AURORADERM_INTERNAL_CONSOLE_AUTH_PRIMARY=legacy_password para cleanup por clave.`
        );
    }

    if (
        status.status === 'legacy_auth_not_configured' ||
        status.configured === false
    ) {
        throw new Error(
            'Legacy admin login no configurado. Define AURORADERM_ADMIN_PASSWORD y el override legacy en el servidor objetivo.'
        );
    }

    const response = await requestJson(
        baseUrl,
        'POST',
        '/admin-auth.php?action=login',
        {
            ...options,
            body: { password },
        }
    );
    if (!(response.ok && response.json)) {
        throw new Error(`admin login failed http ${response.status}`);
    }
    if (response.json.ok === false) {
        throw new Error(String(response.json.error || 'admin login invalid'));
    }
    if (response.json.twoFactorRequired === true) {
        throw new Error('admin login requiere 2FA');
    }

    const csrfToken = String(response.json.csrfToken || '');
    const cookie = options.cookieJar
        ? options.cookieJar.header()
        : response.cookieHeader;
    if (!csrfToken) {
        throw new Error('csrf token vacio');
    }
    if (!cookie) {
        throw new Error('cookie de sesion vacia');
    }

    return {
        mode: 'legacy_password',
        csrfToken,
        cookie,
        status,
        loginResponse: response,
    };
}

async function loginWithOpenClaw(baseUrl, options = {}) {
    const statusResponse = await fetchAdminAuthStatus(baseUrl, options);
    const status = normalizeAuthStatusPayload(statusResponse);
    if (
        status.mode !== CANONICAL_OPERATOR_AUTH_MODE &&
        status.mode !== LEGACY_OPERATOR_AUTH_MODE
    ) {
        throw new Error(
            `Operator auth no disponible. El servidor expone ${status.mode || 'legacy_password'} como modo primario.`
        );
    }

    if (
        status.status === 'operator_auth_not_configured' ||
        status.configured === false
    ) {
        throw new Error(
            'Operator auth no configurado en el servidor objetivo. Verifica broker OAuth/OIDC, bridge y allowlist.'
        );
    }

    const start = await startAdminAuthChallenge(baseUrl, options);
    if (!(start.status === 202 && start.json && start.json.ok === true)) {
        throw new Error(`operator auth start failed http ${start.status}`);
    }

    const challenge =
        start.json && typeof start.json.challenge === 'object'
            ? start.json.challenge
            : null;
    if (!challenge) {
        throw new Error('challenge operator auth ausente');
    }

    const helperResult = await resolveOperatorChallenge(
        {
            challengeId: String(challenge.challengeId || ''),
            nonce: String(challenge.nonce || ''),
            serverBaseUrl: trimTrailingSlash(baseUrl),
            manualCode: String(challenge.manualCode || ''),
            rawQuery: {
                challengeId: String(challenge.challengeId || ''),
                nonce: String(challenge.nonce || ''),
                serverBaseUrl: trimTrailingSlash(baseUrl),
                manualCode: String(challenge.manualCode || ''),
            },
        },
        options.helperOptions || {}
    );

    if (String(helperResult.status || '') !== 'completed') {
        throw new Error(
            String(
                helperResult.error ||
                    'El helper local no pudo completar la autenticacion operator auth.'
            )
        );
    }

    const session = await fetchAdminAuthStatus(baseUrl, options);
    if (!(session.ok && session.json && session.json.authenticated === true)) {
        throw new Error(`operator auth status failed http ${session.status}`);
    }

    const csrfToken = String(session.json.csrfToken || '');
    const cookie = options.cookieJar
        ? options.cookieJar.header()
        : session.cookieHeader;
    if (!csrfToken) {
        throw new Error('csrf token operator auth vacio');
    }
    if (!cookie) {
        throw new Error('cookie de sesion operator auth vacia');
    }

    return {
        mode: status.mode || CANONICAL_OPERATOR_AUTH_MODE,
        csrfToken,
        cookie,
        status,
        startResponse: start,
        sessionResponse: session,
        helperResult,
    };
}

async function loginAdmin(baseUrl, options = {}) {
    const password = firstNonEmpty(options.password);
    const statusResponse = await fetchAdminAuthStatus(baseUrl, options);
    const status = normalizeAuthStatusPayload(statusResponse);

    if (
        status.mode === CANONICAL_OPERATOR_AUTH_MODE ||
        status.mode === LEGACY_OPERATOR_AUTH_MODE
    ) {
        return loginWithOpenClaw(baseUrl, options);
    }

    if (!password) {
        throw new Error(
            'admin-password vacio para login legacy. Usa --admin-password o configura TEST_ADMIN_PASSWORD.'
        );
    }

    return loginWithLegacyPassword(baseUrl, password, options);
}

module.exports = {
    createCookieJar,
    fetchAdminAuthStatus,
    loginAdmin,
    loginWithLegacyPassword,
    loginWithOpenClaw,
    logoutAdmin,
    normalizeAuthStatusPayload,
    requestJson,
    startAdminAuthChallenge,
    trimTrailingSlash,
};
