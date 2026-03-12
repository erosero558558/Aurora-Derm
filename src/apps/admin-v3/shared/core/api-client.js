let csrfToken = '';

function normalizeJson(payload) {
    if (payload && typeof payload === 'object') return payload;
    return {};
}

async function requestJsonRaw(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
    };

    const init = {
        method,
        credentials: 'same-origin',
        headers,
    };

    if (method !== 'GET' && csrfToken) {
        init.headers['X-CSRF-Token'] = csrfToken;
    }

    if (options.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const text = await response.text();
    let payload;
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (_error) {
        throw new Error(`Respuesta no valida (${response.status})`);
    }

    return {
        ok: response.ok && payload.ok !== false,
        status: Number(response.status || 0),
        payload: normalizeJson(payload),
    };
}

function toRequestError(result) {
    const payload =
        result && result.payload && typeof result.payload === 'object'
            ? result.payload
            : {};
    const error = new Error(
        payload.error ||
            payload.message ||
            `HTTP ${Number(result && result.status) || 0}`
    );
    error.status = Number(result && result.status) || 0;
    error.payload = payload;
    return error;
}

async function requestJson(url, options = {}) {
    const result = await requestJsonRaw(url, options);
    if (!result.ok) {
        throw toRequestError(result);
    }
    return result.payload;
}

export function setApiCsrfToken(token) {
    csrfToken = String(token || '');
}

export function getApiCsrfToken() {
    return csrfToken;
}

export async function apiRequest(resource, options = {}) {
    const url = new URL('/api.php', window.location.origin);
    url.searchParams.set('resource', String(resource || ''));

    const query =
        options.query && typeof options.query === 'object' ? options.query : null;
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }
            url.searchParams.set(String(key), String(value));
        });
    }

    const { query: _query, ...requestOptions } = options;
    return requestJson(`${url.pathname}${url.search}`, requestOptions);
}

export async function authRequestRaw(action, options = {}) {
    const url = `/admin-auth.php?action=${encodeURIComponent(action)}`;
    return requestJsonRaw(url, options);
}

export async function authRequest(action, options = {}) {
    const url = `/admin-auth.php?action=${encodeURIComponent(action)}`;
    return requestJson(url, options);
}
