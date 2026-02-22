import {
    API_ENDPOINT,
    API_REQUEST_TIMEOUT_MS,
    API_DEFAULT_RETRIES,
    API_SLOW_NOTICE_MS,
    API_SLOW_NOTICE_COOLDOWN_MS,
    API_RETRY_BASE_DELAY_MS,
} from './config.js';
import {
    state,
    getApiSlowNoticeLastAt,
    setApiSlowNoticeLastAt,
} from './state.js';
import { showToast, waitMs } from '../src/apps/shared/utils.js';

export async function apiRequest(resource, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const query = new URLSearchParams({ resource: resource });
    if (options.query && typeof options.query === 'object') {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.set(key, String(value));
            }
        });
    }
    const url = `${API_ENDPOINT}?${query.toString()}`;
    const requestInit = {
        method: method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
        },
    };

    if (options.body !== undefined) {
        requestInit.headers['Content-Type'] = 'application/json';
        requestInit.body = JSON.stringify(options.body);
    }

    const timeoutMs = Number.isFinite(options.timeoutMs)
        ? Math.max(1500, Number(options.timeoutMs))
        : API_REQUEST_TIMEOUT_MS;
    const maxRetries = Number.isInteger(options.retries)
        ? Math.max(0, Number(options.retries))
        : method === 'GET'
          ? API_DEFAULT_RETRIES
          : 0;

    const shouldShowSlowNotice = options.silentSlowNotice !== true;
    const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

    function makeApiError(message, status = 0, retryable = false, code = '') {
        const error = new Error(message);
        error.status = status;
        error.retryable = retryable;
        error.code = code;
        return error;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let slowNoticeTimer = null;

        if (shouldShowSlowNotice) {
            slowNoticeTimer = setTimeout(() => {
                const now = Date.now();
                if (
                    now - getApiSlowNoticeLastAt() >
                    API_SLOW_NOTICE_COOLDOWN_MS
                ) {
                    setApiSlowNoticeLastAt(now);
                    showToast(
                        state.currentLang === 'es'
                            ? 'Conectando con el servidor...'
                            : 'Connecting to server...',
                        'info'
                    );
                }
            }, API_SLOW_NOTICE_MS);
        }

        try {
            const response = await fetch(url, {
                ...requestInit,
                signal: controller.signal,
            });

            const responseText = await response.text();
            let payload = {};
            try {
                payload = responseText ? JSON.parse(responseText) : {};
            } catch (error) {
                throw makeApiError(
                    'Respuesta del servidor no es JSON valido',
                    response.status,
                    false,
                    'invalid_json'
                );
            }

            if (!response.ok || payload.ok === false) {
                const message = payload.error || `HTTP ${response.status}`;
                throw makeApiError(
                    message,
                    response.status,
                    retryableStatusCodes.has(response.status),
                    'http_error'
                );
            }

            return payload;
        } catch (error) {
            const normalizedError = (() => {
                if (error && error.name === 'AbortError') {
                    return makeApiError(
                        state.currentLang === 'es'
                            ? 'Tiempo de espera agotado con el servidor'
                            : 'Server request timed out',
                        0,
                        true,
                        'timeout'
                    );
                }

                if (error instanceof Error) {
                    if (typeof error.retryable !== 'boolean') {
                        error.retryable = false;
                    }
                    if (typeof error.status !== 'number') {
                        error.status = 0;
                    }
                    return error;
                }

                return makeApiError(
                    'Error de conexion con el servidor',
                    0,
                    true,
                    'network_error'
                );
            })();

            lastError = normalizedError;

            const canRetry =
                attempt < maxRetries && normalizedError.retryable === true;
            if (!canRetry) {
                throw normalizedError;
            }

            const retryDelay = API_RETRY_BASE_DELAY_MS * (attempt + 1);
            await waitMs(retryDelay);
        } finally {
            clearTimeout(timeoutId);
            if (slowNoticeTimer !== null) {
                clearTimeout(slowNoticeTimer);
            }
        }
    }

    throw lastError || new Error('No se pudo completar la solicitud');
}
