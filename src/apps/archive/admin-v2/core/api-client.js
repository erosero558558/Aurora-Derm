let csrfToken = '';

function normalizeJson(payload) {
    if (payload && typeof payload === 'object') return payload;
    return {};
}

async function requestJson(url, options = {}) {
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

    payload = normalizeJson(payload);
    if (!response.ok || payload.ok === false) {
        throw new Error(
            payload.error || payload.message || `HTTP ${response.status}`
        );
    }

    return payload;
}

export function setApiCsrfToken(token) {
    csrfToken = String(token || '');
}

export function getApiCsrfToken() {
    return csrfToken;
}

export async function apiRequest(resource, options = {}) {
    const url = `/api.php?resource=${encodeURIComponent(resource)}`;
    return requestJson(url, options);
}

export async function authRequest(action, options = {}) {
    const url = `/admin-auth.php?action=${encodeURIComponent(action)}`;
    return requestJson(url, options);
}
