(function () {
    'use strict';

    // Canonical source for the browser DataEngine, bundled via src/bundles/data.js.
    (function () {

        let deps = null;

        const API_ENDPOINT = '/api.php';
        const API_REQUEST_TIMEOUT_MS = 9000;
        const UPLOAD_REQUEST_TIMEOUT_MS = 16000;
        const API_RETRY_BASE_DELAY_MS = 450;
        const API_DEFAULT_RETRIES = 1;
        const API_SLOW_NOTICE_MS = 1200;
        const API_SLOW_NOTICE_COOLDOWN_MS = 25000;
        const AVAILABILITY_CACHE_TTL_MS = 60 * 1000;
        const BOOKED_SLOTS_CACHE_TTL_MS = 10 * 1000;
        const LOCAL_FALLBACK_ENABLED = window.location.protocol === 'file:';

        let apiSlowNoticeLastAt = 0;
        const apiInFlightGetRequests = new Map();
        const availabilityCache = new Map();
        const availabilityCachePromises = new Map();
        const bookedSlotsCache = new Map();

        function init(inputDeps) {
            deps = inputDeps || deps || {};
            return window.Piel && window.Piel.DataEngine;
        }

        function getLang() {
            return deps && typeof deps.getCurrentLang === 'function'
                ? deps.getCurrentLang() || 'es'
                : 'es';
        }

        function showToastSafe(message, type) {
            if (deps && typeof deps.showToast === 'function') {
                deps.showToast(message, type);
            }
        }

        function storageGetJSON(key, fallback) {
            if (deps && typeof deps.storageGetJSON === 'function') {
                return deps.storageGetJSON(key, fallback);
            }
            return fallback;
        }

        function storageSetJSON(key, value) {
            if (deps && typeof deps.storageSetJSON === 'function') {
                deps.storageSetJSON(key, value);
            }
        }

        function waitMs(ms) {
            if (deps && typeof deps.waitMs === 'function') {
                return deps.waitMs(ms);
            }
            return new Promise((resolve) => setTimeout(resolve, ms));
        }

        function getApiRetryDelayMs(attempt) {
            const cappedAttempt = Math.max(0, Math.min(5, Number(attempt) || 0));
            const jitter = Math.floor(Math.random() * 180);
            return API_RETRY_BASE_DELAY_MS * 2 ** cappedAttempt + jitter;
        }

        function isLikelyNetworkError(error) {
            if (!error || typeof error !== 'object') {
                return false;
            }

            const name = String(error.name || '').toLowerCase();
            const message = String(error.message || '').toLowerCase();

            if (name === 'typeerror') {
                return true;
            }

            return (
                message.includes('failed to fetch') ||
                message.includes('networkerror') ||
                message.includes('network request failed') ||
                message.includes('load failed') ||
                message.includes('fetch')
            );
        }

        function makeApiError(message, status = 0, retryable = false, code = '') {
            const error = new Error(message);
            error.status = status;
            error.retryable = retryable;
            error.code = code;
            return error;
        }

        async function apiRequest(resource, options = {}) {
            const method = String(options.method || 'GET').toUpperCase();
            const query = new URLSearchParams({ resource: resource });
            if (options.query && typeof options.query === 'object') {
                Object.entries(options.query).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        query.set(key, String(value));
                    }
                });
            }

            const url = API_ENDPOINT + '?' + query.toString();
            const requestInit = {
                method: method,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                },
            };

            const protectedResources = new Set([
                'payment-intent',
                'appointments',
                'callbacks',
                'reviews',
            ]);
            if (
                protectedResources.has(resource) &&
                deps &&
                typeof deps.getCaptchaToken === 'function'
            ) {
                try {
                    const token = await deps.getCaptchaToken(resource);
                    if (token) {
                        requestInit.headers['X-Captcha-Token'] = token;
                    }
                } catch (_error) {
                    // CAPTCHA token is optional for robustness.
                }
            }

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

            const shouldShowSlowNotice =
                options.silentSlowNotice !== true && options.background !== true;
            const retryableStatusCodes = new Set([
                408, 425, 429, 500, 502, 503, 504,
            ]);
            const dedupeGet = method === 'GET' && options.dedupe !== false;

            const execute = async () => {
                let lastError = null;

                for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(
                        () => controller.abort(),
                        timeoutMs
                    );
                    let slowNoticeTimer = null;

                    if (shouldShowSlowNotice) {
                        slowNoticeTimer = setTimeout(() => {
                            const now = Date.now();
                            if (
                                now - apiSlowNoticeLastAt >
                                API_SLOW_NOTICE_COOLDOWN_MS
                            ) {
                                apiSlowNoticeLastAt = now;
                                showToastSafe(
                                    getLang() === 'es'
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
                        } catch (_error) {
                            throw makeApiError(
                                'Respuesta del servidor no es JSON valido',
                                response.status,
                                retryableStatusCodes.has(response.status),
                                'invalid_json'
                            );
                        }

                        if (!response.ok || payload.ok === false) {
                            const message =
                                payload.error || 'HTTP ' + response.status;
                            const apiCode =
                                payload.code ||
                                payload.errorCode ||
                                'http_error';
                            throw makeApiError(
                                message,
                                response.status,
                                retryableStatusCodes.has(response.status),
                                apiCode
                            );
                        }

                        return payload;
                    } catch (error) {
                        const normalizedError = (() => {
                            if (error && error.name === 'AbortError') {
                                return makeApiError(
                                    getLang() === 'es'
                                        ? 'Tiempo de espera agotado con el servidor'
                                        : 'Server request timed out',
                                    0,
                                    true,
                                    'timeout'
                                );
                            }

                            if (isLikelyNetworkError(error)) {
                                return makeApiError(
                                    getLang() === 'es'
                                        ? 'No se pudo conectar con el servidor'
                                        : 'Could not connect to server',
                                    0,
                                    true,
                                    'network_error'
                                );
                            }

                            if (error instanceof Error) {
                                if (typeof error.retryable !== 'boolean') {
                                    error.retryable = false;
                                }
                                if (typeof error.status !== 'number') {
                                    error.status = 0;
                                }
                                if (typeof error.code !== 'string' || !error.code) {
                                    error.code = 'api_error';
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
                            attempt < maxRetries &&
                            normalizedError.retryable === true;
                        if (!canRetry) {
                            throw normalizedError;
                        }

                        await waitMs(getApiRetryDelayMs(attempt));
                    } finally {
                        clearTimeout(timeoutId);
                        if (slowNoticeTimer !== null) {
                            clearTimeout(slowNoticeTimer);
                        }
                    }
                }

                throw lastError || new Error('No se pudo completar la solicitud');
            };

            if (!dedupeGet) {
                return execute();
            }

            if (apiInFlightGetRequests.has(url)) {
                return apiInFlightGetRequests.get(url);
            }

            const inFlight = execute().finally(() => {
                apiInFlightGetRequests.delete(url);
            });

            apiInFlightGetRequests.set(url, inFlight);
            return inFlight;
        }

        async function uploadTransferProof(file, options = {}) {
            const formData = new FormData();
            formData.append('proof', file);

            const query = new URLSearchParams({ resource: 'transfer-proof' });
            const url = `${API_ENDPOINT}?${query.toString()}`;
            const timeoutMs = Number.isFinite(options.timeoutMs)
                ? Math.max(3000, Number(options.timeoutMs))
                : UPLOAD_REQUEST_TIMEOUT_MS;
            const maxRetries = Number.isInteger(options.retries)
                ? Math.max(0, Number(options.retries))
                : 1;
            const retryableStatusCodes = new Set([
                408, 425, 429, 500, 502, 503, 504,
            ]);

            let captchaToken = '';
            if (deps && typeof deps.getCaptchaToken === 'function') {
                try {
                    captchaToken = await deps.getCaptchaToken('transfer_proof');
                } catch (_error) {
                    // CAPTCHA token is optional for robustness.
                }
            }

            let lastError = null;

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                try {
                    const headers = {};
                    if (captchaToken) {
                        headers['X-Captcha-Token'] = captchaToken;
                    }

                    const response = await fetch(url, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: headers,
                        body: formData,
                        signal: controller.signal,
                    });

                    const text = await response.text();
                    let payload = {};
                    try {
                        payload = text ? JSON.parse(text) : {};
                    } catch (_error) {
                        const parseError = new Error(
                            'No se pudo interpretar la respuesta de subida'
                        );
                        parseError.retryable = retryableStatusCodes.has(
                            response.status
                        );
                        parseError.status = response.status;
                        throw parseError;
                    }

                    if (!response.ok || payload.ok === false) {
                        const httpError = new Error(
                            payload.error || `HTTP ${response.status}`
                        );
                        httpError.retryable = retryableStatusCodes.has(
                            response.status
                        );
                        httpError.status = response.status;
                        throw httpError;
                    }

                    return payload.data || {};
                } catch (error) {
                    const normalizedError = (() => {
                        if (error && error.name === 'AbortError') {
                            const timeoutError = new Error(
                                getLang() === 'es'
                                    ? 'Tiempo de espera agotado al subir el comprobante'
                                    : 'Upload timed out while sending proof file'
                            );
                            timeoutError.retryable = true;
                            timeoutError.code = 'timeout';
                            return timeoutError;
                        }

                        if (isLikelyNetworkError(error)) {
                            const networkError = new Error(
                                getLang() === 'es'
                                    ? 'No se pudo conectar con el servidor al subir el comprobante'
                                    : 'Could not connect to server while uploading proof'
                            );
                            networkError.retryable = true;
                            networkError.code = 'network_error';
                            return networkError;
                        }

                        if (error instanceof Error) {
                            if (typeof error.retryable !== 'boolean') {
                                error.retryable = false;
                            }
                            return error;
                        }

                        const fallbackError = new Error(
                            getLang() === 'es'
                                ? 'No se pudo subir el comprobante'
                                : 'Unable to upload proof'
                        );
                        fallbackError.retryable = true;
                        fallbackError.code = 'upload_error';
                        return fallbackError;
                    })();

                    lastError = normalizedError;
                    const canRetry =
                        attempt < maxRetries && normalizedError.retryable === true;
                    if (!canRetry) {
                        throw normalizedError;
                    }

                    await waitMs(getApiRetryDelayMs(attempt));
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            throw lastError || new Error('No se pudo subir el comprobante');
        }

        function getBookedSlotsCacheKey(date, doctor = '', service = '') {
            return `${String(date || '')}::${String(doctor || '')}::${String(service || '')}`;
        }

        function invalidateBookedSlotsCache(date = '', doctor = '', service = '') {
            const targetDate = String(date || '').trim();
            const targetDoctor = String(doctor || '').trim();
            const targetService = String(service || '').trim();
            if (!targetDate) {
                bookedSlotsCache.clear();
                return;
            }

            for (const key of bookedSlotsCache.keys()) {
                if (!key.startsWith(`${targetDate}::`)) {
                    continue;
                }
                if (targetDoctor === '' && targetService === '') {
                    bookedSlotsCache.delete(key);
                    continue;
                }

                const parts = key.split('::');
                const keyDoctor = parts[1] || '';
                const keyService = parts[2] || '';
                const doctorMatches =
                    targetDoctor === '' || keyDoctor === targetDoctor;
                const serviceMatches =
                    targetService === '' || keyService === targetService;
                if (doctorMatches && serviceMatches) {
                    bookedSlotsCache.delete(key);
                }
            }
        }

        function getAvailabilityCacheKey(options = {}) {
            const doctor = String(options.doctor || 'indiferente');
            const service = String(options.service || 'consulta');
            const dateFrom = String(options.dateFrom || '');
            const days = Number(options.days || 21);
            return `${doctor}::${service}::${dateFrom}::${days}`;
        }

        async function loadAvailabilityData(options = {}) {
            const forceRefresh = options && options.forceRefresh === true;
            const background = options && options.background === true;
            const strict = options && options.strict === true;
            const doctor = String(options.doctor || 'indiferente');
            const service = String(options.service || 'consulta');
            const dateFrom = String(options.dateFrom || '');
            const days = Number.isFinite(Number(options.days))
                ? Number(options.days)
                : 21;
            const cacheKey = getAvailabilityCacheKey({
                doctor,
                service,
                dateFrom,
                days,
            });
            const now = Date.now();
            const cachedEntry = availabilityCache.get(cacheKey);

            if (
                !forceRefresh &&
                cachedEntry &&
                now - cachedEntry.at < AVAILABILITY_CACHE_TTL_MS
            ) {
                return cachedEntry.data;
            }

            if (!forceRefresh && availabilityCachePromises.has(cacheKey)) {
                return availabilityCachePromises.get(cacheKey);
            }

            const storageKey = `availability:${cacheKey}`;
            const inFlight = (async () => {
                try {
                    const query = {
                        doctor,
                        service,
                    };
                    if (dateFrom) query.dateFrom = dateFrom;
                    if (Number.isFinite(days) && days > 0) query.days = days;

                    const payload = await apiRequest('availability', {
                        query,
                        background,
                        silentSlowNotice: background,
                    });
                    const data =
                        payload && payload.data && typeof payload.data === 'object'
                            ? payload.data
                            : {};
                    availabilityCache.set(cacheKey, {
                        data,
                        at: Date.now(),
                        meta:
                            payload && payload.meta && typeof payload.meta === 'object'
                                ? payload.meta
                                : {},
                    });
                    storageSetJSON(storageKey, data);
                    return data;
                } catch (error) {
                    if (
                        error &&
                        (error.code === 'calendar_unreachable' ||
                            String(error.message || '')
                                .toLowerCase()
                                .includes('calendar_unreachable'))
                    ) {
                        throw error;
                    }

                    const cached = storageGetJSON(storageKey, {});
                    if (
                        cached &&
                        typeof cached === 'object' &&
                        Object.keys(cached).length > 0
                    ) {
                        availabilityCache.set(cacheKey, {
                            data: cached,
                            at: Date.now(),
                            meta: { source: 'local_cache' },
                        });
                        return cached;
                    }

                    if (strict) {
                        throw error;
                    }

                    return {};
                } finally {
                    availabilityCachePromises.delete(cacheKey);
                }
            })();

            availabilityCachePromises.set(cacheKey, inFlight);
            return inFlight;
        }

        async function getBookedSlots(date, doctor = '', service = 'consulta') {
            const cacheKey = getBookedSlotsCacheKey(date, doctor, service);
            const now = Date.now();
            const cachedEntry = bookedSlotsCache.get(cacheKey);
            if (cachedEntry && now - cachedEntry.at < BOOKED_SLOTS_CACHE_TTL_MS) {
                return cachedEntry.slots;
            }

            try {
                const query = { date: date };
                if (doctor) query.doctor = doctor;
                if (service) query.service = service;
                const payload = await apiRequest('booked-slots', { query });
                const slots = Array.isArray(payload.data) ? payload.data : [];
                bookedSlotsCache.set(cacheKey, {
                    slots,
                    at: now,
                });
                return slots;
            } catch (error) {
                if (
                    error &&
                    (error.code === 'calendar_unreachable' ||
                        String(error.message || '')
                            .toLowerCase()
                            .includes('calendar_unreachable'))
                ) {
                    throw error;
                }
                if (!LOCAL_FALLBACK_ENABLED) {
                    throw error;
                }
                const appointments = storageGetJSON('appointments', []);
                const slots = appointments
                    .filter((appointment) => {
                        if (
                            appointment.date !== date ||
                            appointment.status === 'cancelled'
                        )
                            return false;
                        if (doctor && doctor !== 'indiferente') {
                            const currentDoctor = appointment.doctor || '';
                            if (
                                currentDoctor &&
                                currentDoctor !== 'indiferente' &&
                                currentDoctor !== doctor
                            )
                                return false;
                        }
                        return true;
                    })
                    .map((appointment) => appointment.time);
                const uniqueSlots = Array.from(new Set(slots));
                bookedSlotsCache.set(cacheKey, {
                    slots: uniqueSlots,
                    at: now,
                });
                return uniqueSlots;
            }
        }

        async function createAppointmentRecord(appointment, options = {}) {
            const allowLocalFallback = options.allowLocalFallback !== false;
            try {
                const payload = await apiRequest('appointments', {
                    method: 'POST',
                    body: appointment,
                });
                const localAppointments = storageGetJSON('appointments', []);
                localAppointments.push(payload.data);
                storageSetJSON('appointments', localAppointments);
                if (payload && payload.data) {
                    invalidateBookedSlotsCache(
                        payload.data.date || appointment?.date || '',
                        payload.data.doctor || appointment?.doctor || '',
                        payload.data.service || appointment?.service || ''
                    );
                } else {
                    invalidateBookedSlotsCache(
                        appointment?.date || '',
                        appointment?.doctor || '',
                        appointment?.service || ''
                    );
                }
                return {
                    appointment: payload.data,
                    emailSent: payload.emailSent === true,
                };
            } catch (error) {
                if (!LOCAL_FALLBACK_ENABLED || !allowLocalFallback) {
                    throw error;
                }
                const localAppointments = storageGetJSON('appointments', []);
                const fallback = {
                    ...appointment,
                    id: Date.now(),
                    status: 'confirmed',
                    dateBooked: new Date().toISOString(),
                    paymentStatus: appointment.paymentStatus || 'pending',
                };
                localAppointments.push(fallback);
                storageSetJSON('appointments', localAppointments);
                invalidateBookedSlotsCache(
                    fallback.date || appointment?.date || '',
                    fallback.doctor || appointment?.doctor || '',
                    fallback.service || appointment?.service || ''
                );
                return {
                    appointment: fallback,
                    emailSent: false,
                };
            }
        }

        async function createCallbackRecord(callback) {
            try {
                await apiRequest('callbacks', {
                    method: 'POST',
                    body: callback,
                });
            } catch (error) {
                if (!LOCAL_FALLBACK_ENABLED) {
                    throw error;
                }
                const callbacks = storageGetJSON('callbacks', []);
                callbacks.push(callback);
                storageSetJSON('callbacks', callbacks);
            }
        }

        async function createReviewRecord(review) {
            try {
                const payload = await apiRequest('reviews', {
                    method: 'POST',
                    body: review,
                });
                return payload.data;
            } catch (error) {
                if (!LOCAL_FALLBACK_ENABLED) {
                    throw error;
                }
                const localReviews = storageGetJSON('reviews', []);
                localReviews.unshift(review);
                storageSetJSON('reviews', localReviews);
                return review;
            }
        }

        window.Piel = window.Piel || {};
        window.Piel.DataEngine = {
            init,
            apiRequest,
            uploadTransferProof,
            invalidateBookedSlotsCache,
            loadAvailabilityData,
            getBookedSlots,
            createAppointmentRecord,
            createCallbackRecord,
            createReviewRecord,
        };

    })();

    // build-sync: 20260219-sync1

    let deps$1 = null;
    const I18N_HTML_ALLOWED_KEYS = new Set(['clinic_hours']);

    const translations = {
        es: null,
        en: null
    };

    let enTranslationsPromise = null;

    function init$1(inputDeps) {
        deps$1 = inputDeps || {};

        if (window.PIEL_CONTENT && typeof window.PIEL_CONTENT === 'object') {
            translations.es = window.PIEL_CONTENT;
        }

        return window.PielI18nEngine;
    }

    function debugLogSafe() {
        if (deps$1 && typeof deps$1.debugLog === 'function') {
            deps$1.debugLog.apply(null, arguments);
        }
    }

    function setCurrentLang(lang) {
        if (deps$1 && typeof deps$1.setCurrentLang === 'function') {
            deps$1.setCurrentLang(lang);
        }
    }

    function showToastSafe(message, type) {
        if (deps$1 && typeof deps$1.showToast === 'function') {
            deps$1.showToast(message, type);
        }
    }

    function getReviewsCacheSafe() {
        if (deps$1 && typeof deps$1.getReviewsCache === 'function') {
            return deps$1.getReviewsCache();
        }
        return [];
    }

    function renderPublicReviewsSafe(reviews) {
        if (deps$1 && typeof deps$1.renderPublicReviews === 'function') {
            deps$1.renderPublicReviews(reviews);
        }
    }

    function ensureEnglishTranslations() {
        if (translations.en && typeof translations.en === 'object') {
            return Promise.resolve(translations.en);
        }

        if (enTranslationsPromise) {
            return enTranslationsPromise;
        }

        enTranslationsPromise = fetch('/api.php?resource=content&lang=en')
            .then(response => {
                if (!response.ok) throw new Error('Failed to load EN content');
                return response.json();
            })
            .then(data => {
                translations.en = data;
                return translations.en;
            })
            .catch((error) => {
                enTranslationsPromise = null;
                debugLogSafe('English translations load failed:', error);
                throw error;
            });

        return enTranslationsPromise;
    }

    async function changeLanguage(lang) {
        const nextLang = lang === 'en' ? 'en' : 'es';
        setCurrentLang(nextLang);

        localStorage.setItem('language', nextLang);
        document.documentElement.lang = nextLang;

        if (!translations.es || typeof translations.es !== 'object') {
            // Fallback: try to load ES from API if not injected
            try {
                const res = await fetch('/api.php?resource=content&lang=es');
                if (res.ok) {
                    translations.es = await res.json();
                }
            } catch (e) {
                debugLogSafe('Failed to load ES content fallback', e);
            }
        }

        if (nextLang === 'en' && !translations.en) {
            try {
                await ensureEnglishTranslations();
            } catch (_e) {
                showToastSafe('No se pudo cargar el paquete de idioma EN. Se mantiene Espanol.', 'warning');
            }
        }

        const langPack = translations[nextLang] || translations.es || {};

        document.querySelectorAll('.lang-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.lang === nextLang);
        });

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = String(el.dataset.i18n || '').trim();
            if (!Object.prototype.hasOwnProperty.call(langPack, key)) {
                return;
            }
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = langPack[key];
                return;
            }
            if (I18N_HTML_ALLOWED_KEYS.has(key)) {
                el.innerHTML = langPack[key];
                return;
            }
            el.textContent = langPack[key];
        });

        const cachedReviews = getReviewsCacheSafe();
        if (Array.isArray(cachedReviews) && cachedReviews.length > 0) {
            renderPublicReviewsSafe(cachedReviews);
        }

        document.dispatchEvent(new CustomEvent('piel:language-changed', {
            detail: { lang: nextLang }
        }));

        return nextLang;
    }

    window.PielI18nEngine = {
        init: init$1,
        ensureEnglishTranslations,
        changeLanguage
    };

    let deps = null;
    let listenersBound = false;

    function getEngineRef() {
        if (window.Piel && window.Piel.ActionRouterEngine) {
            return window.Piel.ActionRouterEngine;
        }
        return window.PielActionRouterEngine;
    }

    function init(inputDeps) {
        deps = inputDeps || {};
        bindListeners();
        return getEngineRef();
    }

    function callDep(name) {
        if (!deps || typeof deps[name] !== 'function') {
            return undefined;
        }

        const args = Array.prototype.slice.call(arguments, 1);
        return deps[name].apply(null, args);
    }

    function handleActionClick(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
            return;
        }

        const actionEl = target.closest('[data-action]');
        if (!actionEl) {
            return;
        }

        const action = String(actionEl.getAttribute('data-action') || '').trim();
        const value = actionEl.getAttribute('data-value') || '';
        if (!action) {
            return;
        }

        switch (action) {
            case 'toast-close':
                actionEl.closest('.toast')?.remove();
                break;
            case 'set-theme':
                callDep('setThemeMode', value || 'system');
                break;
            case 'set-language':
                callDep('changeLanguage', value || 'es');
                break;
            case 'toggle-mobile-menu':
                callDep('toggleMobileMenu');
                break;
            case 'start-web-video':
                callDep('startWebVideo');
                break;
            case 'open-review-modal':
                callDep('openReviewModal');
                break;
            case 'close-review-modal':
                callDep('closeReviewModal');
                break;
            case 'close-video-modal':
                callDep('closeVideoModal');
                break;
            case 'close-payment-modal':
                callDep('closePaymentModal');
                break;
            case 'process-payment':
                callDep('processPayment');
                break;
            case 'close-success-modal':
                callDep('closeSuccessModal');
                break;
            case 'close-reschedule-modal':
                callDep('closeRescheduleModal');
                break;
            case 'submit-reschedule':
                callDep('submitReschedule');
                break;
            case 'toggle-chatbot':
                callDep('toggleChatbot');
                break;
            case 'send-chat-message':
                callDep('sendChatMessage');
                break;
            case 'chat-booking':
                callDep('handleChatBookingSelection', value);
                break;
            case 'quick-message':
                callDep('sendQuickMessage', value);
                break;
            case 'minimize-chat':
                callDep('minimizeChatbot');
                break;
            case 'start-booking':
                callDep('startChatBooking');
                break;
            case 'select-service':
                callDep('selectService', value);
                break;
        }
    }

    function handleActionChange(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
            return;
        }

        if (target.closest('[data-action="chat-date-select"]')) {
            callDep('handleChatDateSelect', target.value);
        }
    }

    function bindListeners() {
        if (listenersBound) {
            return;
        }
        listenersBound = true;
        document.addEventListener('click', handleActionClick);
        document.addEventListener('change', handleActionChange);
    }

    window.Piel = window.Piel || {};
    window.Piel.ActionRouterEngine = {
        init
    };
    // Legacy global kept for compatibility with older loaders.
    window.PielActionRouterEngine = window.Piel.ActionRouterEngine;

})();
