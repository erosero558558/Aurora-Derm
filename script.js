/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in src/main.js and run npm run build */
(function () {
    'use strict';

    let currentLang = localStorage.getItem('language') || 'es';
    let currentThemeMode = localStorage.getItem('themeMode') || 'system';
    let currentAppointment = null;
    let checkoutSession = {
        active: false,
        completed: false,
        startedAt: 0,
        service: '',
        doctor: '',
    };
    let apiSlowNoticeLastAt = 0;
    const bookedSlotsCache = new Map();
    let reviewsCache = [];
    let paymentConfig = {
        enabled: false,
        provider: 'stripe',
        publishableKey: '',
        currency: 'USD',
    };
    let paymentConfigLoaded = false;
    let paymentConfigLoadedAt = 0;
    let stripeSdkPromise = null;
    let chatbotOpen = false;
    let conversationContext = [];

    function getCurrentLang() {
        return currentLang;
    }
    function setCurrentLang(lang) {
        currentLang = lang;
    }

    function getCurrentThemeMode() {
        return currentThemeMode;
    }
    function setCurrentThemeMode(mode) {
        currentThemeMode = mode;
    }

    function getCurrentAppointment() {
        return currentAppointment;
    }
    function setCurrentAppointment(appt) {
        currentAppointment = appt;
    }

    function getCheckoutSession() {
        return checkoutSession;
    }
    function setCheckoutSession(session) {
        checkoutSession = session;
    }

    function getApiSlowNoticeLastAt() {
        return apiSlowNoticeLastAt;
    }
    function setApiSlowNoticeLastAt(val) {
        apiSlowNoticeLastAt = val;
    }

    function getReviewsCache() {
        return reviewsCache;
    }
    function setReviewsCache(val) {
        reviewsCache = val;
    }

    function getPaymentConfig() {
        return paymentConfig;
    }
    function setPaymentConfig(val) {
        paymentConfig = val;
    }

    function getPaymentConfigLoaded() {
        return paymentConfigLoaded;
    }
    function setPaymentConfigLoaded(val) {
        paymentConfigLoaded = val;
    }

    function getPaymentConfigLoadedAt() {
        return paymentConfigLoadedAt;
    }
    function setPaymentConfigLoadedAt(val) {
        paymentConfigLoadedAt = val;
    }

    function getStripeSdkPromise() {
        return stripeSdkPromise;
    }
    function setStripeSdkPromise(val) {
        stripeSdkPromise = val;
    }

    function getChatbotOpen() {
        return chatbotOpen;
    }
    function setChatbotOpen(val) {
        chatbotOpen = val;
    }

    function getConversationContext() {
        return conversationContext;
    }
    function setConversationContext(val) {
        conversationContext = val;
    }

    function getChatHistory() {
        try {
            const raw = localStorage.getItem('chatHistory');
            const saved = raw ? JSON.parse(raw) : [];
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            const valid = saved.filter(
                (m) => m.time && new Date(m.time).getTime() > cutoff
            );
            if (valid.length !== saved.length) {
                try {
                    localStorage.setItem('chatHistory', JSON.stringify(valid));
                } catch {
                    // noop
                }
            }
            return valid;
        } catch {
            return [];
        }
    }
    function setChatHistory(history) {
        try {
            localStorage.setItem('chatHistory', JSON.stringify(history));
        } catch {
            // noop
        }
    }

    const stateAccessors = {
        currentLang: [getCurrentLang, setCurrentLang],
        currentThemeMode: [getCurrentThemeMode, setCurrentThemeMode],
        currentAppointment: [getCurrentAppointment, setCurrentAppointment],
        checkoutSession: [getCheckoutSession, setCheckoutSession],
        reviewsCache: [getReviewsCache, setReviewsCache],
        chatbotOpen: [getChatbotOpen, setChatbotOpen],
        conversationContext: [getConversationContext, setConversationContext],
    };

    const internalState = {
        bookedSlotsCache,
    };

    const handler = {
        get(target, prop, receiver) {
            if (prop === 'chatHistory') {
                return getChatHistory();
            }
            if (Object.prototype.hasOwnProperty.call(stateAccessors, prop)) {
                return stateAccessors[prop][0]();
            }
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            if (prop === 'chatHistory') {
                setChatHistory(value);
                return true;
            }
            if (prop === 'bookedSlotsCache') {
                return false;
            }
            if (Object.prototype.hasOwnProperty.call(stateAccessors, prop)) {
                stateAccessors[prop][1](value);
                return true;
            }
            return Reflect.set(target, prop, value, receiver);
        },
    };

    const state = new Proxy(internalState, handler);

    const API_ENDPOINT = '/api.php';
    const CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
    const CLINIC_MAP_URL =
        'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
    const DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
    const DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
    const COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';
    const API_REQUEST_TIMEOUT_MS = 9000;
    const API_RETRY_BASE_DELAY_MS = 450;
    const API_DEFAULT_RETRIES = 1;
    const API_SLOW_NOTICE_MS = 1200;
    const API_SLOW_NOTICE_COOLDOWN_MS = 25000;
    const THEME_STORAGE_KEY = 'themeMode';
    const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);

    function debugLog() {
        // Debug logging removed
    }

    function escapeHtml$1(text) {
        if (
            window.Piel &&
            window.Piel.ChatUiEngine &&
            typeof window.Piel.ChatUiEngine.escapeHtml === 'function'
        ) {
            return window.Piel.ChatUiEngine.escapeHtml(text);
        }
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    function waitMs(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isConstrainedNetworkConnection() {
        const connection =
            navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;
        return !!(
            connection &&
            (connection.saveData === true ||
                /(^|[^0-9])2g/.test(String(connection.effectiveType || '')))
        );
    }

    // ASSET VERSIONING
    function resolveDeployAssetVersion() {
        try {
            if (
                document.currentScript &&
                typeof document.currentScript.src === 'string' &&
                document.currentScript.src !== ''
            ) {
                const currentUrl = new URL(
                    document.currentScript.src,
                    window.location.href
                );
                const fromCurrent = currentUrl.searchParams.get('v');
                if (fromCurrent) {
                    return fromCurrent;
                }
            }

            const scriptEl = document.querySelector('script[src*="script.js"]');
            if (scriptEl && typeof scriptEl.getAttribute === 'function') {
                const rawSrc = scriptEl.getAttribute('src') || '';
                if (rawSrc) {
                    const parsed = new URL(rawSrc, window.location.href);
                    const fromTag = parsed.searchParams.get('v');
                    if (fromTag) {
                        return fromTag;
                    }
                }
            }
        } catch (_error) {
            return '';
        }

        return '';
    }

    function withDeployAssetVersion(url) {
        const cleanUrl = String(url || '').trim();
        if (cleanUrl === '') {
            return cleanUrl;
        }

        const deployVersion = (window.Piel && window.Piel.deployVersion) || '';
        if (!deployVersion) {
            return cleanUrl;
        }

        try {
            const resolved = new URL(cleanUrl, window.location.origin);
            resolved.searchParams.set('cv', deployVersion);
            if (cleanUrl.startsWith('/')) {
                return resolved.pathname + resolved.search;
            }
            return resolved.toString();
        } catch (_error) {
            const separator = cleanUrl.indexOf('?') >= 0 ? '&' : '?';
            return cleanUrl + separator + 'cv=' + encodeURIComponent(deployVersion);
        }
    }

    // TOAST NOTIFICATIONS SYSTEM
    function showToast(message, type = 'info', title = '') {
        // Create container if doesn't exist
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-circle',
            info: 'fa-info-circle',
        };

        const titles = {
            success: title || 'Exito',
            error: title || 'Error',
            warning: title || 'Advertencia',
            info: title || 'Informacion',
        };

        // Escapar mensaje para prevenir XSS
        const safeMsg = String(message)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${safeMsg}</div>
        </div>
        <button type="button" class="toast-close" data-action="toast-close">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    function storageGetJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            return value === null ? fallback : value;
        } catch (_error) {
            return fallback;
        }
    }

    function storageSetJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_error) {
            // Ignore storage quota errors.
        }
    }

    const deferredModulePromises = new Map();

    function loadDeferredModule(options) {
        const {
            cacheKey,
            src,
            scriptDataAttribute,
            resolveModule,
            isModuleReady = (module) => !!module,
            onModuleReady,
            missingApiError = 'Deferred module loaded without expected API',
            loadError = 'No se pudo cargar el modulo diferido',
            logLabel = '',
        } = options || {};

        if (
            !cacheKey ||
            !src ||
            !scriptDataAttribute ||
            typeof resolveModule !== 'function'
        ) {
            return Promise.reject(
                new Error('Invalid deferred module configuration')
            );
        }

        const getReadyModule = () => {
            const module = resolveModule();
            if (!isModuleReady(module)) {
                return null;
            }

            if (typeof onModuleReady === 'function') {
                onModuleReady(module);
            }

            return module;
        };

        const readyModule = getReadyModule();
        if (readyModule) {
            return Promise.resolve(readyModule);
        }

        if (deferredModulePromises.has(cacheKey)) {
            return deferredModulePromises.get(cacheKey);
        }

        const promise = new Promise((resolve, reject) => {
            const handleLoad = () => {
                const module = getReadyModule();
                if (module) {
                    resolve(module);
                    return;
                }
                reject(new Error(missingApiError));
            };

            import(src)
                .then(() => {
                    if (
                        !document.querySelector(
                            'script[' + scriptDataAttribute + '="true"]'
                        )
                    ) {
                        const marker = document.createElement('script');
                        marker.setAttribute(scriptDataAttribute, 'true');
                        marker.dataset.dynamicImport = 'true';
                        document.head.appendChild(marker);
                    }
                    handleLoad();
                })
                .catch((err) => {
                    reject(new Error(loadError));
                });
        }).catch((error) => {
            deferredModulePromises.delete(cacheKey);
            throw error;
        });

        deferredModulePromises.set(cacheKey, promise);
        return promise;
    }

    function scheduleDeferredTask(task, options = {}) {
        const {
            idleTimeout = 2000,
            fallbackDelay = 1200,
            skipOnConstrained = true,
            constrainedDelay = fallbackDelay,
        } = options;

        if (isConstrainedNetworkConnection()) {
            if (skipOnConstrained) {
                return false;
            }
            setTimeout(task, constrainedDelay);
            return true;
        }

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(task, { timeout: idleTimeout });
        } else {
            setTimeout(task, fallbackDelay);
        }

        return true;
    }

    function bindWarmupTarget(selector, eventName, handler, passive = true) {
        const element = document.querySelector(selector);
        if (!element) {
            return false;
        }

        element.addEventListener(eventName, handler, { once: true, passive });
        return true;
    }

    function createOnceTask(task) {
        let executed = false;

        return function runOnce() {
            if (executed) {
                return;
            }

            executed = true;
            task();
        };
    }

    function createWarmupRunner(loadFn, options = {}) {
        const markWarmOnSuccess = options.markWarmOnSuccess === true;
        let warmed = false;

        return function warmup() {
            if (warmed || window.location.protocol === 'file:') {
                return;
            }

            if (markWarmOnSuccess) {
                Promise.resolve(loadFn())
                    .then(() => {
                        warmed = true;
                    })
                    .catch(() => undefined);
                return;
            }

            warmed = true;
            Promise.resolve(loadFn()).catch(() => {
                warmed = false;
            });
        };
    }

    function observeOnceWhenVisible(element, onVisible, options = {}) {
        const { threshold = 0.05, rootMargin = '0px', onNoObserver } = options;

        if (!element) {
            return false;
        }

        if (!('IntersectionObserver' in window)) {
            if (typeof onNoObserver === 'function') {
                onNoObserver();
            }
            return false;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }
                    onVisible(entry);
                    observer.disconnect();
                });
            },
            {
                threshold,
                rootMargin,
            }
        );

        observer.observe(element);
        return true;
    }

    function withDeferredModule(loader, onReady) {
        return Promise.resolve()
            .then(() => loader())
            .then((module) => onReady(module));
    }

    function runDeferredModule(loader, onReady, onError) {
        return withDeferredModule(loader, onReady).catch((error) => {
            if (typeof onError === 'function') {
                return onError(error);
            }
            return undefined;
        });
    }

    const UI_BUNDLE_URL$3 = withDeployAssetVersion(
        '/js/engines/ui-bundle.js?v=20260220-consolidated1'
    );
    const systemThemeQuery = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    function getThemeEngineDeps() {
        return {
            getCurrentThemeMode: () => state.currentThemeMode,
            setCurrentThemeMode: (mode) => {
                state.currentThemeMode = VALID_THEME_MODES.has(mode) ? mode : 'system';
            },
            themeStorageKey: THEME_STORAGE_KEY,
            validThemeModes: Array.from(VALID_THEME_MODES),
            getSystemThemeQuery: () => systemThemeQuery,
        };
    }

    function loadThemeEngine() {
        return loadDeferredModule({
            cacheKey: 'theme-engine',
            src: UI_BUNDLE_URL$3,
            scriptDataAttribute: 'data-ui-bundle',
            resolveModule: () => window.Piel && window.Piel.ThemeEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getThemeEngineDeps()),
            missingApiError: 'theme-engine loaded without API',
            loadError: 'No se pudo cargar theme-engine.js',
            logLabel: 'Theme engine',
        });
    }

    function setThemeMode(mode) {
        runDeferredModule(loadThemeEngine, (engine) => engine.setThemeMode(mode));
    }

    function initThemeMode() {
        runDeferredModule(loadThemeEngine, (engine) => engine.initThemeMode());
    }

    let captchaPromise = null;

    function getCaptchaConfig() {
        const piel = window.Piel || {};
        const config = piel.config || {};
        const captcha = config.captcha || {};
        return {
            provider: String(captcha.provider || '').trim().toLowerCase(),
            siteKey: String(captcha.siteKey || '').trim(),
            scriptUrl: String(captcha.scriptUrl || '').trim(),
        };
    }

    function loadCaptchaScript() {
        if (captchaPromise) return captchaPromise;

        const config = getCaptchaConfig();
        if (!config.provider || !config.siteKey || !config.scriptUrl) {
            return Promise.resolve(null);
        }

        captchaPromise = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = config.scriptUrl;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve(config.provider);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        });

        return captchaPromise;
    }

    async function getCaptchaToken(action) {
        const normalizedAction = String(action || '').trim() || 'submit';
        try {
            const provider = await loadCaptchaScript();
            if (!provider) return null;

            const config = getCaptchaConfig();
            const siteKey = config.siteKey;

            if (provider === 'recaptcha') {
                if (!window.grecaptcha || typeof window.grecaptcha.ready !== 'function') {
                    return null;
                }
                return new Promise((resolve) => {
                    window.grecaptcha.ready(async () => {
                        try {
                            const token = await window.grecaptcha.execute(siteKey, {
                                action: normalizedAction,
                            });
                            resolve(token || null);
                        } catch (_) {
                            resolve(null);
                        }
                    });
                });
            }

            if (provider === 'turnstile') {
                if (!window.turnstile || typeof window.turnstile.render !== 'function') {
                    return null;
                }

                const target = document.createElement('div');
                target.style.display = 'none';
                document.body.appendChild(target);

                return new Promise((resolve) => {
                    let widgetId = null;
                    const cleanup = () => {
                        try {
                            if (widgetId !== null && window.turnstile && typeof window.turnstile.remove === 'function') {
                                window.turnstile.remove(widgetId);
                            }
                        } catch (_) {
                            // noop
                        }
                        target.remove();
                    };

                    try {
                        widgetId = window.turnstile.render(target, {
                            sitekey: siteKey,
                            action: normalizedAction,
                            callback: (token) => {
                                cleanup();
                                resolve(token || null);
                            },
                            'error-callback': () => {
                                cleanup();
                                resolve(null);
                            },
                        });
                    } catch (_) {
                        cleanup();
                        resolve(null);
                    }
                });
            }
        } catch (_) {
            return null;
        }

        return null;
    }

    const DATA_ENGINE_URL = withDeployAssetVersion(
        '/js/engines/data-engine.js?v=figo-data-20260219-phase1'
    );

    function getDataEngineDeps() {
        return {
            getCurrentLang: () => state.currentLang,
            getCaptchaToken,
            showToast,
            storageGetJSON,
            storageSetJSON,
        };
    }

    function loadDataEngine() {
        return loadDeferredModule({
            cacheKey: 'data-engine',
            src: DATA_ENGINE_URL,
            scriptDataAttribute: 'data-data-engine',
            resolveModule: () => window.Piel && window.Piel.DataEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getDataEngineDeps()),
            missingApiError: 'data-engine loaded without API',
            loadError: 'No se pudo cargar data-engine.js',
            logLabel: 'Data engine',
        });
    }

    function initDataEngineWarmup() {
        const warmup = createWarmupRunner(() => loadDataEngine(), {
            markWarmOnSuccess: true,
        });

        bindWarmupTarget('#appointmentForm', 'focusin', warmup, false);
        bindWarmupTarget('#appointmentForm', 'pointerdown', warmup);
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'pointerdown', warmup);

        const bookingSection = document.getElementById('citas');
        observeOnceWhenVisible(bookingSection, warmup, {
            threshold: 0.05,
            rootMargin: '260px 0px',
            onNoObserver: warmup,
        });

        scheduleDeferredTask(warmup, {
            idleTimeout: 1800,
            fallbackDelay: 900,
        });
    }

    async function apiRequest$1(resource, options = {}) {
        return withDeferredModule(loadDataEngine, (engine) =>
            engine.apiRequest(resource, options)
        );
    }

    function invalidateBookedSlotsCache(date = '', doctor = '', service = '') {
        if (
            window.Piel &&
            window.Piel.DataEngine &&
            typeof window.Piel.DataEngine.invalidateBookedSlotsCache === 'function'
        ) {
            window.Piel.DataEngine.invalidateBookedSlotsCache(date, doctor, service);
            return;
        }
        withDeferredModule(loadDataEngine, (engine) =>
            engine.invalidateBookedSlotsCache(date, doctor, service)
        ).catch(() => undefined);
    }

    async function loadAvailabilityData(options = {}) {
        return withDeferredModule(loadDataEngine, (engine) =>
            engine.loadAvailabilityData(options)
        );
    }

    async function getBookedSlots(date, doctor = '', service = '') {
        return withDeferredModule(loadDataEngine, (engine) =>
            engine.getBookedSlots(date, doctor, service)
        );
    }

    async function createAppointmentRecord(appointment, options = {}) {
        return withDeferredModule(loadDataEngine, (engine) =>
            engine.createAppointmentRecord(appointment, options)
        );
    }

    async function createCallbackRecord(callback) {
        return withDeferredModule(loadDataEngine, (engine) =>
            engine.createCallbackRecord(callback)
        );
    }

    async function createReviewRecord(review) {
        return withDeferredModule(loadDataEngine, (engine) =>
            engine.createReviewRecord(review)
        );
    }

    async function uploadTransferProof(file, options = {}) {
        return withDeferredModule(loadDataEngine, (engine) =>
            engine.uploadTransferProof(file, options)
        );
    }

    const ENGAGEMENT_BUNDLE_URL = withDeployAssetVersion(
        '/js/engines/engagement-bundle.js?v=20260220-consolidated1'
    );

    // REVIEWS ENGINE
    function getReviewsEngineDeps() {
        return {
            apiRequest: apiRequest$1,
            storageGetJSON,
            escapeHtml: escapeHtml$1,
            getCurrentLang: getCurrentLang,
        };
    }

    function loadReviewsEngine() {
        return loadDeferredModule({
            cacheKey: 'engagement-bundle',
            src: ENGAGEMENT_BUNDLE_URL,
            scriptDataAttribute: 'data-engagement-bundle',
            resolveModule: () => window.Piel && window.Piel.ReviewsEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getReviewsEngineDeps()),
            missingApiError: 'reviews-engine loaded without API',
            loadError: 'No se pudo cargar reviews-engine.js',
            logLabel: 'Reviews engine',
        });
    }

    function initReviewsEngineWarmup() {
        const warmup = createWarmupRunner(() => loadReviewsEngine(), {
            markWarmOnSuccess: true,
        });
        const reviewSection = document.getElementById('resenas');
        observeOnceWhenVisible(reviewSection, warmup, {
            threshold: 0.05,
            rootMargin: '300px 0px',
            onNoObserver: warmup,
        });
        bindWarmupTarget('#resenas', 'mouseenter', warmup);
        bindWarmupTarget('#resenas', 'touchstart', warmup);
        bindWarmupTarget(
            '#resenas [data-action="open-review-modal"]',
            'focus',
            warmup,
            false
        );
        scheduleDeferredTask(warmup, { idleTimeout: 2200, fallbackDelay: 1300 });
    }

    function renderPublicReviews(reviews) {
        runDeferredModule(loadReviewsEngine, (engine) =>
            engine.renderPublicReviews(reviews)
        );
    }

    function loadPublicReviews(options = {}) {
        return withDeferredModule(loadReviewsEngine, (engine) =>
            engine.loadPublicReviews(options)
        );
    }

    // ENGAGEMENT FORMS ENGINE
    function getEngagementFormsEngineDeps() {
        return {
            createCallbackRecord,
            createReviewRecord,
            renderPublicReviews,
            showToast,
            getCurrentLang: getCurrentLang,
            getReviewsCache,
            setReviewsCache,
        };
    }

    function loadEngagementFormsEngine() {
        return loadReviewsEngine().then(() =>
            loadDeferredModule({
                cacheKey: 'engagement-forms-engine',
                src: ENGAGEMENT_BUNDLE_URL,
                scriptDataAttribute: 'data-engagement-bundle',
                resolveModule: () => window.Piel && window.Piel.EngagementFormsEngine,
                isModuleReady: (module) =>
                    !!(module && typeof module.init === 'function'),
                onModuleReady: (module) =>
                    module.init(getEngagementFormsEngineDeps()),
                missingApiError: 'engagement-forms-engine loaded without API',
                loadError: 'No se pudo cargar engagement-forms-engine.js',
                logLabel: 'Engagement forms engine',
            })
        );
    }

    function initEngagementFormsEngineWarmup() {
        const warmup = createWarmupRunner(() => loadEngagementFormsEngine());
        bindWarmupTarget('#callbackForm', 'focusin', warmup, false);
        bindWarmupTarget('#callbackForm', 'pointerdown', warmup);
        bindWarmupTarget(
            '#resenas [data-action="open-review-modal"]',
            'mouseenter',
            warmup
        );
        bindWarmupTarget(
            '#resenas [data-action="open-review-modal"]',
            'touchstart',
            warmup
        );
        if (document.getElementById('callbackForm')) {
            setTimeout(warmup, 120);
        }
        const reviewSection = document.getElementById('resenas');
        observeOnceWhenVisible(reviewSection, warmup, {
            threshold: 0.05,
            rootMargin: '280px 0px',
            onNoObserver: warmup,
        });
        scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1500 });
    }

    function openReviewModal() {
        runDeferredModule(
            loadEngagementFormsEngine,
            (engine) => engine.openReviewModal(),
            () => {
                const modal = document.getElementById('reviewModal');
                if (modal) {
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        );
    }

    function closeReviewModal() {
        const modal = document.getElementById('reviewModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
        runDeferredModule(loadEngagementFormsEngine, (engine) =>
            engine.closeReviewModal()
        );
    }

    const DATA_BUNDLE_URL$1 = withDeployAssetVersion(
        '/js/engines/data-bundle.js?v=20260221-api-fix'
    );

    function getI18nEngineDeps() {
        return {
            getCurrentLang: () => state.currentLang,
            setCurrentLang: (lang) => {
                state.currentLang = (lang === 'en' ? 'en' : 'es');
            },
            showToast,
            getReviewsCache: () => state.reviewsCache,
            renderPublicReviews,
            debugLog,
        };
    }

    function loadI18nEngine() {
        return loadDeferredModule({
            cacheKey: 'i18n-engine',
            src: DATA_BUNDLE_URL$1,
            scriptDataAttribute: 'data-data-bundle',
            resolveModule: () =>
                (window.Piel && window.Piel.I18nEngine) || window.PielI18nEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getI18nEngineDeps()),
            missingApiError: 'i18n-engine loaded without API',
            loadError: 'No se pudo cargar i18n-engine.js',
            logLabel: 'I18n engine',
        });
    }

    function initEnglishBundleWarmup() {
        const warmup = () => {
            withDeferredModule(loadI18nEngine, (engine) =>
                engine.ensureEnglishTranslations()
            ).catch(() => undefined);
        };

        const enBtn = document.querySelector('.lang-btn[data-lang="en"]');
        if (enBtn) {
            enBtn.addEventListener('mouseenter', warmup, {
                once: true,
                passive: true,
            });
            enBtn.addEventListener('touchstart', warmup, {
                once: true,
                passive: true,
            });
            enBtn.addEventListener('focus', warmup, { once: true });
        }
    }

    async function changeLanguage(lang) {
        return withDeferredModule(loadI18nEngine, (engine) =>
            engine.changeLanguage(lang)
        );
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

    const BOOKING_UTILS_URL$2 = withDeployAssetVersion('/js/engines/booking-utils.js');

    function getPaymentGatewayEngineDeps() {
        return {
            apiRequest,
            getCurrentLang,
            getPaymentConfig, setPaymentConfig,
            getPaymentConfigLoaded, setPaymentConfigLoaded,
            getPaymentConfigLoadedAt, setPaymentConfigLoadedAt,
            getStripeSdkPromise, setStripeSdkPromise,
            apiEndpoint: API_ENDPOINT,
            apiRequestTimeoutMs: API_REQUEST_TIMEOUT_MS
        };
    }

    function loadPaymentGatewayEngine() {
        return loadDeferredModule({
            cacheKey: 'booking-utils',
            src: BOOKING_UTILS_URL$2,
            scriptDataAttribute: 'data-booking-utils',
            resolveModule: () => window.Piel && window.Piel.PaymentGatewayEngine,
            isModuleReady: (module) => !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getPaymentGatewayEngineDeps()),
            missingApiError: 'payment-gateway-engine loaded without API',
            loadError: 'No se pudo cargar payment-gateway-engine (booking-utils)',
            logLabel: 'Payment gateway engine'
        });
    }

    async function loadPaymentConfig() {
        return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.loadPaymentConfig());
    }

    async function loadStripeSdk() {
        return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.loadStripeSdk());
    }

    async function createPaymentIntent(appointment) {
        return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.createPaymentIntent(appointment));
    }

    async function verifyPaymentIntent(paymentIntentId) {
        return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.verifyPaymentIntent(paymentIntentId));
    }

    const ANALYTICS_ENGINE_URL = withDeployAssetVersion(
        '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
    );
    const FUNNEL_EVENT_ENDPOINT = '/api.php?resource=funnel-event';
    const FUNNEL_SERVER_EVENTS = new Set([
        'view_booking',
        'start_checkout',
        'payment_method_selected',
        'payment_success',
        'booking_confirmed',
        'checkout_abandon',
        'booking_step_completed',
        'booking_error',
        'checkout_error',
        'chat_started',
        'chat_handoff_whatsapp',
        'whatsapp_click',
    ]);
    const FUNNEL_SERVER_ALLOWED_PARAMS = new Set([
        'source',
        'step',
        'payment_method',
        'checkout_entry',
        'checkout_step',
        'reason',
        'error_code',
    ]);
    const FUNNEL_EVENT_DEDUP_MS = 1200;
    const funnelEventLastSentAt = new Map();

    function normalizeFunnelLabelClient(value, fallback = 'unknown') {
        if (value === null || value === undefined) {
            return fallback;
        }
        const normalized = String(value)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48);
        return normalized || fallback;
    }

    function buildFunnelServerParams(params = {}) {
        const sourceRaw =
            params && typeof params === 'object' ? params.source : undefined;
        const normalized = {
            source: normalizeFunnelLabelClient(sourceRaw, 'unknown'),
        };

        if (!params || typeof params !== 'object') {
            return normalized;
        }

        FUNNEL_SERVER_ALLOWED_PARAMS.forEach((key) => {
            if (key === 'source') {
                return;
            }
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                normalized[key] = normalizeFunnelLabelClient(
                    params[key],
                    'unknown'
                );
            }
        });

        return normalized;
    }

    function sendFunnelEventToServer(eventName, params = {}) {
        const normalizedEvent = normalizeFunnelLabelClient(eventName, '');
        if (!FUNNEL_SERVER_EVENTS.has(normalizedEvent)) {
            return;
        }
        if (window.location.protocol === 'file:') {
            return;
        }

        const serverParams = buildFunnelServerParams(params);
        const dedupKey = [
            normalizedEvent,
            serverParams.step || '',
            serverParams.payment_method || '',
            serverParams.checkout_step || serverParams.step || '',
            serverParams.reason || '',
            serverParams.source || '',
        ].join('|');

        const now = Date.now();
        const previousAt = funnelEventLastSentAt.get(dedupKey) || 0;
        if (now - previousAt < FUNNEL_EVENT_DEDUP_MS) {
            return;
        }
        funnelEventLastSentAt.set(dedupKey, now);

        const payload = JSON.stringify({
            event: normalizedEvent,
            params: serverParams,
        });

        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                const sent = navigator.sendBeacon(FUNNEL_EVENT_ENDPOINT, blob);
                if (sent) {
                    return;
                }
            }
        } catch (_error) {}

        fetch(FUNNEL_EVENT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: payload,
            keepalive: true,
            credentials: 'same-origin',
        }).catch(() => undefined);
    }

    function getAnalyticsEngineDeps() {
        return {
            observeOnceWhenVisible,
            loadAvailabilityData,
            loadPublicReviews,
            trackEventToServer: sendFunnelEventToServer,
        };
    }

    function loadAnalyticsEngine() {
        return loadDeferredModule({
            cacheKey: 'analytics-engine',
            src: ANALYTICS_ENGINE_URL,
            scriptDataAttribute: 'data-analytics-engine',
            resolveModule: () => window.Piel && window.Piel.AnalyticsEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getAnalyticsEngineDeps()),
            missingApiError: 'analytics-engine loaded without API',
            loadError: 'No se pudo cargar analytics-engine.js',
            logLabel: 'Analytics engine',
        });
    }

    function trackEvent(eventName, params = {}) {
        sendFunnelEventToServer(eventName, params);
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.trackEvent(eventName, params)
        );
    }

    function normalizeAnalyticsLabel(value, fallback = 'unknown') {
        if (value === null || value === undefined) {
            return fallback;
        }
        const normalized = String(value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 64);
        return normalized || fallback;
    }

    function markBookingViewed(source = 'unknown') {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.markBookingViewed(source)
        );
    }

    function initBookingFunnelObserver() {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.initBookingFunnelObserver()
        );
    }

    function initDeferredSectionPrefetch() {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.initDeferredSectionPrefetch()
        );
    }

    function maybeTrackCheckoutAbandon$1(reason = 'unknown') {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.maybeTrackCheckoutAbandon(reason)
        );
    }

    const UI_BUNDLE_URL$2 = withDeployAssetVersion(
        '/js/engines/ui-bundle.js?v=20260220-consolidated1'
    );

    function getSuccessModalEngineDeps() {
        return {
            getCurrentLang,
            getCurrentAppointment,
            getClinicAddress: () => CLINIC_ADDRESS,
            escapeHtml: escapeHtml$1,
        };
    }

    function loadSuccessModalEngine() {
        return loadDeferredModule({
            cacheKey: 'success-modal-engine',
            src: UI_BUNDLE_URL$2,
            scriptDataAttribute: 'data-ui-bundle',
            resolveModule: () => window.Piel && window.Piel.SuccessModalEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getSuccessModalEngineDeps()),
            missingApiError: 'success-modal-engine loaded without API',
            loadError: 'No se pudo cargar success-modal-engine.js',
            logLabel: 'Success modal engine',
        });
    }

    function initSuccessModalEngineWarmup() {
        const warmup = createWarmupRunner(() => loadSuccessModalEngine());
        bindWarmupTarget(
            '#appointmentForm button[type="submit"]',
            'pointerdown',
            warmup
        );
        bindWarmupTarget(
            '#appointmentForm button[type="submit"]',
            'focus',
            warmup,
            false
        );
        bindWarmupTarget('.payment-method', 'pointerdown', warmup);
        scheduleDeferredTask(warmup, { idleTimeout: 2800, fallbackDelay: 1600 });
    }

    function showSuccessModal(emailSent = false) {
        const appt = getCurrentAppointment();
        if (appt) {
            try {
                localStorage.setItem('last_confirmed_appointment', JSON.stringify(appt));
            } catch (e) {
                // noop
            }
        }

        runDeferredModule(
            loadSuccessModalEngine,
            (engine) => engine.showSuccessModal(emailSent),
            () => {
                showToast('No se pudo abrir la confirmacion de cita.', 'error');
            }
        );
    }

    function closeSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
        runDeferredModule(loadSuccessModalEngine, (engine) =>
            engine.closeSuccessModal()
        );
    }

    const BOOKING_ENGINE_URL = withDeployAssetVersion(
        '/js/engines/booking-engine.js?v=figo-booking-20260219-mbfix1'
    );
    const BOOKING_UI_URL = withDeployAssetVersion(
        '/js/engines/booking-ui.js?v=figo-booking-ui-20260222-slotservicefix1'
    );
    const BOOKING_UTILS_URL$1 = withDeployAssetVersion('/js/engines/booking-utils.js');
    const CASE_PHOTO_UPLOAD_CONCURRENCY = 2;

    function stripTransientAppointmentFields(appointment) {
        const payload = { ...appointment };
        delete payload.casePhotoFiles;
        delete payload.casePhotoUploads;
        return payload;
    }

    async function ensureCasePhotosUploaded(appointment) {
        const files = Array.isArray(appointment?.casePhotoFiles)
            ? appointment.casePhotoFiles
            : [];
        if (files.length === 0) {
            return { names: [], urls: [], paths: [] };
        }

        if (
            Array.isArray(appointment.casePhotoUploads) &&
            appointment.casePhotoUploads.length > 0
        ) {
            return {
                names: appointment.casePhotoUploads
                    .map((item) => String(item.name || ''))
                    .filter(Boolean),
                urls: appointment.casePhotoUploads
                    .map((item) => String(item.url || ''))
                    .filter(Boolean),
                paths: appointment.casePhotoUploads
                    .map((item) => String(item.path || ''))
                    .filter(Boolean),
            };
        }

        const uploads = new Array(files.length);
        const workerCount = Math.max(
            1,
            Math.min(CASE_PHOTO_UPLOAD_CONCURRENCY, files.length)
        );
        let cursor = 0;

        const uploadWorker = async () => {
            while (cursor < files.length) {
                const index = cursor;
                cursor += 1;
                const file = files[index];
                const uploaded = await uploadTransferProof(file, { retries: 2 });
                uploads[index] = {
                    name: uploaded.transferProofName || file.name || '',
                    url: uploaded.transferProofUrl || '',
                    path: uploaded.transferProofPath || '',
                };
            }
        };

        await Promise.all(
            Array.from({ length: workerCount }, () => uploadWorker())
        );
        appointment.casePhotoUploads = uploads;

        return {
            names: uploads.map((item) => String(item.name || '')).filter(Boolean),
            urls: uploads.map((item) => String(item.url || '')).filter(Boolean),
            paths: uploads.map((item) => String(item.path || '')).filter(Boolean),
        };
    }

    async function buildAppointmentPayload(appointment) {
        const payload = stripTransientAppointmentFields(appointment || {});
        const uploadedPhotos = await ensureCasePhotosUploaded(appointment || {});
        payload.casePhotoCount = uploadedPhotos.urls.length;
        payload.casePhotoNames = uploadedPhotos.names;
        payload.casePhotoUrls = uploadedPhotos.urls;
        payload.casePhotoPaths = uploadedPhotos.paths;
        return payload;
    }

    function getBookingEngineDeps() {
        return {
            getCurrentLang: () => state.currentLang,
            getCurrentAppointment: () => state.currentAppointment,
            setCurrentAppointment: (appt) => { state.currentAppointment = appt; },
            getCheckoutSession: () => state.checkoutSession,
            setCheckoutSessionActive: (active) => { state.checkoutSession.active = (active === true); },
            startCheckoutSession,
            setCheckoutStep,
            completeCheckoutSession,
            maybeTrackCheckoutAbandon,
            loadPaymentConfig,
            loadStripeSdk,
            createPaymentIntent,
            verifyPaymentIntent,
            buildAppointmentPayload,
            stripTransientAppointmentFields,
            createAppointmentRecord,
            uploadTransferProof,
            getCaptchaToken,
            showSuccessModal,
            showToast,
            debugLog,
            trackEvent,
            normalizeAnalyticsLabel,
        };
    }

    function loadBookingEngine() {
        return loadDeferredModule({
            cacheKey: 'booking-engine',
            src: BOOKING_ENGINE_URL,
            scriptDataAttribute: 'data-booking-engine',
            resolveModule: () => window.Piel && window.Piel.BookingEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getBookingEngineDeps()),
            missingApiError: 'Booking engine loaded without API',
            loadError: 'No se pudo cargar booking-engine.js',
            logLabel: 'Booking engine',
        });
    }

    function initBookingEngineWarmup() {
        const warmup = createWarmupRunner(() => loadBookingEngine(), {
            markWarmOnSuccess: true,
        });

        const selectors = [
            '.nav-cta[href="#citas"]',
            '.quick-dock-item[href="#citas"]',
            '.hero-actions a[href="#citas"]',
        ];

        selectors.forEach((selector) => {
            bindWarmupTarget(selector, 'mouseenter', warmup);
            bindWarmupTarget(selector, 'focus', warmup, false);
            bindWarmupTarget(selector, 'touchstart', warmup);
        });

        scheduleDeferredTask(warmup, {
            idleTimeout: 2500,
            fallbackDelay: 1100,
        });
    }

    // CHECKOUT SESSION WRAPPERS
    function startCheckoutSession(appointment, metadata = {}) {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.startCheckoutSession(appointment, metadata)
        );
    }

    function setCheckoutStep(step, metadata = {}) {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.setCheckoutStep(step, metadata)
        );
    }

    function completeCheckoutSession(method) {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.completeCheckoutSession(method)
        );
    }

    function maybeTrackCheckoutAbandon(reason = 'unknown') {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.maybeTrackCheckoutAbandon(reason)
        );
    }

    function loadBookingCalendarEngine() {
        return loadDeferredModule({
            cacheKey: 'booking-utils-calendar',
            src: BOOKING_UTILS_URL$1,
            scriptDataAttribute: 'data-booking-utils',
            resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine,
            isModuleReady: (module) => !!(module && typeof module.initCalendar === 'function'),
            missingApiError: 'booking-calendar-engine loaded without API',
            loadError: 'No se pudo cargar booking-calendar-engine',
            logLabel: 'Booking Calendar engine'
        });
    }

    async function updateAvailableTimes(elements) {
        return runDeferredModule(loadBookingCalendarEngine, (engine) => engine.updateAvailableTimes(getBookingUiDeps(), elements));
    }

    // BOOKING UI
    function getDefaultTimeSlots() {
        return ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
    }

    function getBookingUiDeps() {
        return {
            loadAvailabilityData,
            getBookedSlots,
            updateAvailableTimes,
            getDefaultTimeSlots,
            showToast,
            getCurrentLang: () => state.currentLang,
            getCasePhotoFiles: (form) => {
                const input = form?.querySelector('#casePhotos');
                if (!input || !input.files) return [];
                return Array.from(input.files);
            },
            validateCasePhotoFiles,
            markBookingViewed,
            startCheckoutSession,
            setCheckoutStep,
            trackEvent,
            normalizeAnalyticsLabel,
            openPaymentModal,
            debugLog,
            setCurrentAppointment: setCurrentAppointment,
        };
    }

    function validateCasePhotoFiles(files) {
        const MAX_CASE_PHOTOS = 3;
        const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
        const CASE_PHOTO_ALLOWED_TYPES = new Set([
            'image/jpeg',
            'image/png',
            'image/webp',
        ]);

        if (!Array.isArray(files) || files.length === 0) return;

        if (files.length > MAX_CASE_PHOTOS) {
            throw new Error(
                state.currentLang === 'es'
                    ? `Puedes subir m\u00E1ximo ${MAX_CASE_PHOTOS} fotos.`
                    : `You can upload up to ${MAX_CASE_PHOTOS} photos.`
            );
        }

        for (const file of files) {
            if (!file) continue;

            if (file.size > MAX_CASE_PHOTO_BYTES) {
                throw new Error(
                    state.currentLang === 'es'
                        ? `Cada foto debe pesar m\u00E1ximo ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
                        : `Each photo must be at most ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
                );
            }

            const mime = String(file.type || '').toLowerCase();
            const validByMime = CASE_PHOTO_ALLOWED_TYPES.has(mime);
            const validByExt = /\.(jpe?g|png|webp)$/i.test(String(file.name || ''));
            if (!validByMime && !validByExt) {
                throw new Error(
                    state.currentLang === 'es'
                        ? 'Solo se permiten im\u00e1genes JPG, PNG o WEBP.'
                        : 'Only JPG, PNG or WEBP images are allowed.'
                );
            }
        }
    }

    function loadBookingUi() {
        return loadDeferredModule({
            cacheKey: 'booking-ui',
            src: BOOKING_UI_URL,
            scriptDataAttribute: 'data-booking-ui',
            resolveModule: () => window.Piel && window.Piel.BookingUi,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => {
                module.init(getBookingUiDeps());
                window.PielBookingUiReady = true;
            },
            missingApiError: 'booking-ui loaded without API',
            loadError: 'No se pudo cargar booking-ui.js',
            logLabel: 'Booking UI',
        });
    }

    function initBookingUiWarmup() {
        const warmup = createWarmupRunner(() => loadBookingUi());

        const bookingSection = document.getElementById('citas');
        observeOnceWhenVisible(bookingSection, warmup, {
            threshold: 0.05,
            rootMargin: '320px 0px',
            onNoObserver: warmup,
        });

        const appointmentForm = document.getElementById('appointmentForm');
        if (appointmentForm) {
            appointmentForm.addEventListener('focusin', warmup, { once: true });
            appointmentForm.addEventListener('pointerdown', warmup, {
                once: true,
                passive: true,
            });
            setTimeout(warmup, 120);
        }

        if (!bookingSection && !appointmentForm) {
            return;
        }

        scheduleDeferredTask(warmup, {
            idleTimeout: 1800,
            fallbackDelay: 1100,
        });
    }

    function openPaymentModal(appointmentData) {
        runDeferredModule(
            loadBookingEngine,
            (engine) => engine.openPaymentModal(appointmentData),
            (error) => {
                showToast('No se pudo abrir el modulo de pago.', 'error');
            }
        );
    }

    function closePaymentModal(options = {}) {
        if (
            window.Piel &&
            window.Piel.BookingEngine &&
            typeof window.Piel.BookingEngine.closePaymentModal === 'function'
        ) {
            window.Piel.BookingEngine.closePaymentModal(options);
            return;
        }

        const skipAbandonTrack = options && options.skipAbandonTrack === true;
        const abandonReason =
            options && typeof options.reason === 'string'
                ? options.reason
                : 'modal_close';
        if (!skipAbandonTrack) {
            maybeTrackCheckoutAbandon(abandonReason);
        }

        state.checkoutSession.active = false;
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    async function processPayment() {
        return runDeferredModule(
            loadBookingEngine,
            (engine) => engine.processPayment(),
            (error) => {
                showToast('No se pudo procesar el pago en este momento.', 'error');
            }
        );
    }

    const UI_BUNDLE_URL$1 = withDeployAssetVersion(
        '/js/engines/ui-bundle.js?v=20260220-consolidated1'
    );

    // UI Effects
    function loadUiEffects() {
        return loadDeferredModule({
            cacheKey: 'ui-effects',
            src: UI_BUNDLE_URL$1,
            scriptDataAttribute: 'data-ui-bundle',
            resolveModule: () => window.Piel && window.Piel.UiEffects,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(),
            missingApiError: 'ui-effects loaded without API',
            loadError: 'No se pudo cargar ui-effects.js',
            logLabel: 'UI effects',
        });
    }

    function initUiEffectsWarmup() {
        const warmup = createWarmupRunner(() => loadUiEffects());
        bindWarmupTarget('.nav', 'mouseenter', warmup);
        bindWarmupTarget('.nav', 'touchstart', warmup);
        const triggerOnce = () => warmup();
        window.addEventListener('scroll', triggerOnce, {
            once: true,
            passive: true,
        });
        window.addEventListener('pointerdown', triggerOnce, {
            once: true,
            passive: true,
        });
        scheduleDeferredTask(warmup, { idleTimeout: 1800, fallbackDelay: 1200 });
    }

    function toggleMobileMenu(forceClose) {
        const menu = document.getElementById('mobileMenu');
        if (forceClose === false) {
            menu.classList.remove('active');
            document.body.style.overflow = '';
            return;
        }
        menu.classList.toggle('active');
        document.body.style.overflow = menu.classList.contains('active')
            ? 'hidden'
            : '';
    }

    // Modal UX Engine
    function getModalUxEngineDeps() {
        return {
            closePaymentModal,
            toggleMobileMenu,
        };
    }

    function loadModalUxEngine() {
        return loadDeferredModule({
            cacheKey: 'modal-ux-engine',
            src: UI_BUNDLE_URL$1,
            scriptDataAttribute: 'data-ui-bundle',
            resolveModule: () => window.Piel && window.Piel.ModalUxEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getModalUxEngineDeps()),
            missingApiError: 'modal-ux-engine loaded without API',
            loadError: 'No se pudo cargar modal-ux-engine.js',
            logLabel: 'Modal UX engine',
        });
    }

    function initModalUxEngineWarmup() {
        const warmup = createWarmupRunner(() => loadModalUxEngine());
        bindWarmupTarget('.modal', 'pointerdown', warmup);
        bindWarmupTarget('.modal-close', 'pointerdown', warmup);
        if (document.querySelector('.modal')) {
            setTimeout(warmup, 180);
        }
        scheduleDeferredTask(warmup, { idleTimeout: 2200, fallbackDelay: 1200 });
    }

    function startWebVideo() {
        const modal = document.getElementById('videoModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeVideoModal() {
        const modal = document.getElementById('videoModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    const BOOKING_UTILS_URL = withDeployAssetVersion(
        '/js/engines/booking-utils.js?v=figo-booking-utils-20260220-unified'
    );

    function getRescheduleEngineDeps() {
        return {
            apiRequest: apiRequest$1,
            loadAvailabilityData,
            getBookedSlots,
            invalidateBookedSlotsCache,
            showToast,
            escapeHtml: escapeHtml$1,
            getCurrentLang: getCurrentLang,
        };
    }

    function loadRescheduleEngine() {
        return loadDeferredModule({
            cacheKey: 'booking-utils',
            src: BOOKING_UTILS_URL,
            scriptDataAttribute: 'data-booking-utils',
            resolveModule: () => window.PielRescheduleEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getRescheduleEngineDeps()),
            missingApiError: 'reschedule-engine loaded without API',
            loadError: 'No se pudo cargar booking-utils.js (reschedule)',
            logLabel: 'Reschedule engine',
        });
    }

    function initRescheduleEngineWarmup() {
        runDeferredModule(
            loadRescheduleEngine,
            (engine) => engine.checkRescheduleParam(),
            () => {
                showToast(
                    getCurrentLang() === 'es'
                        ? 'No se pudo cargar la reprogramacion.'
                        : 'Unable to load reschedule flow.',
                    'error'
                );
            }
        );
    }

    function closeRescheduleModal() {
        runDeferredModule(
            loadRescheduleEngine,
            (engine) => engine.closeRescheduleModal(),
            () => {
                const modal = document.getElementById('rescheduleModal');
                if (modal) {
                    modal.classList.remove('active');
                }
            }
        );
    }

    function submitReschedule() {
        runDeferredModule(
            loadRescheduleEngine,
            (engine) => engine.submitReschedule(),
            () => {
                showToast(
                    getCurrentLang() === 'es'
                        ? 'No se pudo reprogramar en este momento.'
                        : 'Unable to reschedule right now.',
                    'error'
                );
            }
        );
    }

    const CHAT_UI_ENGINE_URL = withDeployAssetVersion(
        '/js/engines/chat-ui-engine.js?v=figo-chat-ui-20260219-phase1-sync1'
    );
    const CHAT_WIDGET_ENGINE_URL = withDeployAssetVersion(
        '/js/engines/chat-widget-engine.js?v=figo-chat-widget-20260219-phase2-notification2-funnel1-sync1'
    );
    const CHAT_BOOKING_ENGINE_URL = withDeployAssetVersion(
        '/js/engines/chat-booking-engine.js?v=figo-chat-booking-20260219-mbfix1'
    );
    const FIGO_CHAT_ENGINE_URL = withDeployAssetVersion(
        '/js/engines/chat-engine.js?v=figo-chat-20260223-openclaw-queue1'
    );

    const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';
    const CHAT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
    const CHAT_HISTORY_MAX_ITEMS = 50;
    const CHAT_CONTEXT_MAX_ITEMS = 24;

    function escapeHtml(text) {
        if (
            window.Piel &&
            window.Piel.ChatUiEngine &&
            typeof window.Piel.ChatUiEngine.escapeHtml === 'function'
        ) {
            return window.Piel.ChatUiEngine.escapeHtml(text);
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function scrollToBottom() {
        if (
            window.Piel &&
            window.Piel.ChatUiEngine &&
            typeof window.Piel.ChatUiEngine.scrollToBottom === 'function'
        ) {
            window.Piel.ChatUiEngine.scrollToBottom();
            return;
        }
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function addUserMessage(text) {
        return withDeferredModule(loadChatUiEngine, (engine) =>
            engine.addUserMessage(text)
        );
    }

    function addBotMessage(html, showOfflineLabel = false) {
        return runDeferredModule(loadChatUiEngine, (engine) =>
            engine.addBotMessage(html, showOfflineLabel)
        );
    }

    function showTypingIndicator() {
        runDeferredModule(loadChatUiEngine, (engine) =>
            engine.showTypingIndicator()
        );
    }

    function removeTypingIndicator() {
        runDeferredModule(loadChatUiEngine, (engine) =>
            engine.removeTypingIndicator()
        );
    }

    function getChatUiEngineDeps() {
        return {
            getChatHistory: () => state.chatHistory,
            setChatHistory: (h) => { state.chatHistory = h; },
            getConversationContext: () => state.conversationContext,
            setConversationContext: (c) => { state.conversationContext = c; },
            historyStorageKey: CHAT_HISTORY_STORAGE_KEY,
            historyTtlMs: CHAT_HISTORY_TTL_MS,
            historyMaxItems: CHAT_HISTORY_MAX_ITEMS,
            contextMaxItems: CHAT_CONTEXT_MAX_ITEMS,
            debugLog,
        };
    }

    function loadChatUiEngine() {
        return loadDeferredModule({
            cacheKey: 'chat-ui-engine',
            src: CHAT_UI_ENGINE_URL,
            scriptDataAttribute: 'data-chat-ui-engine',
            resolveModule: () => window.Piel && window.Piel.ChatUiEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getChatUiEngineDeps()),
            missingApiError: 'chat-ui-engine loaded without API',
            loadError: 'No se pudo cargar chat-ui-engine.js',
            logLabel: 'Chat UI engine',
        });
    }

    function initChatUiEngineWarmup() {
        const warmup = createWarmupRunner(() => loadChatUiEngine(), {
            markWarmOnSuccess: true,
        });
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
        bindWarmupTarget('#chatInput', 'focus', warmup, false);
        scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1300 });
    }

    function getChatWidgetEngineDeps() {
        return {
            getChatbotOpen: () => state.chatbotOpen,
            setChatbotOpen: (val) => { state.chatbotOpen = val; },
            getChatHistoryLength: () => state.chatHistory.length,
            warmChatUi: () => runDeferredModule(loadChatUiEngine, () => undefined),
            scrollToBottom,
            trackEvent,
            debugLog,
            addBotMessage,
            addUserMessage,
            processWithKimi,
            startChatBooking,
        };
    }

    function loadChatWidgetEngine() {
        return loadDeferredModule({
            cacheKey: 'chat-widget-engine',
            src: CHAT_WIDGET_ENGINE_URL,
            scriptDataAttribute: 'data-chat-widget-engine',
            resolveModule: () => window.Piel && window.Piel.ChatWidgetEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getChatWidgetEngineDeps()),
            missingApiError: 'chat-widget-engine loaded without API',
            loadError: 'No se pudo cargar chat-widget-engine.js',
            logLabel: 'Chat widget engine',
        });
    }

    function initChatWidgetEngineWarmup() {
        const warmup = createWarmupRunner(() => loadChatWidgetEngine(), {
            markWarmOnSuccess: true,
        });
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
        bindWarmupTarget('#chatInput', 'focus', warmup, false);
        scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1300 });
    }

    function toggleChatbot() {
        runDeferredModule(
            loadChatWidgetEngine,
            (engine) => engine.toggleChatbot(),
            () => {
                const container = document.getElementById('chatbotContainer');
                if (!container) return;
                const isOpen = !getChatbotOpen();
                setChatbotOpen(isOpen);
                container.classList.toggle('active', isOpen);
            }
        );
    }

    function minimizeChatbot() {
        runDeferredModule(
            loadChatWidgetEngine,
            (engine) => engine.minimizeChatbot(),
            () => {
                const container = document.getElementById('chatbotContainer');
                if (container) container.classList.remove('active');
                setChatbotOpen(false);
            }
        );
    }

    function handleChatKeypress(event) {
        runDeferredModule(
            loadChatWidgetEngine,
            (engine) => engine.handleChatKeypress(event),
            () => {
                if (event && event.key === 'Enter') {
                    sendChatMessage();
                }
            }
        );
    }

    async function sendChatMessage() {
        return runDeferredModule(
            loadChatWidgetEngine,
            (engine) => engine.sendChatMessage(),
            async () => {
                const input = document.getElementById('chatInput');
                if (!input) return;
                const message = String(input.value || '').trim();
                if (!message) return;
                await Promise.resolve(addUserMessage(message)).catch(
                    () => undefined
                );
                input.value = '';
                await processWithKimi(message);
            }
        );
    }

    function sendQuickMessage(type) {
        runDeferredModule(
            loadChatWidgetEngine,
            (engine) => engine.sendQuickMessage(type),
            () => {
                if (type === 'appointment') {
                    Promise.resolve(
                        addUserMessage('Quiero agendar una cita')
                    ).catch(() => undefined);
                    startChatBooking();
                    return;
                }
                const quickMessages = {
                    services: 'Que servicios ofrecen?',
                    prices: 'Cuales son los precios?',
                    telemedicine: 'Como funciona la consulta online?',
                    human: 'Quiero hablar con un doctor real',
                    acne: 'Tengo problemas de acne',
                    laser: 'Informacion sobre tratamientos laser',
                    location: 'Donde estan ubicados?',
                };
                const message = quickMessages[type] || type;
                Promise.resolve(addUserMessage(message)).catch(() => undefined);
                processWithKimi(message);
            }
        );
    }

    function getChatBookingEngineDeps() {
        return {
            addBotMessage,
            addUserMessage,
            showTypingIndicator,
            removeTypingIndicator,
            loadAvailabilityData,
            getBookedSlots,
            startCheckoutSession,
            setCheckoutStep,
            completeCheckoutSession,
            createAppointmentRecord,
            getCaptchaToken,
            showToast,
            trackEvent,
            escapeHtml,
            minimizeChatbot,
            openPaymentModal,
            getCurrentLang,
            setCurrentAppointment,
        };
    }

    function loadChatBookingEngine() {
        return loadDeferredModule({
            cacheKey: 'chat-booking-engine',
            src: CHAT_BOOKING_ENGINE_URL,
            scriptDataAttribute: 'data-chat-booking-engine',
            resolveModule: () => window.Piel && window.Piel.ChatBookingEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getChatBookingEngineDeps()),
            missingApiError: 'chat-booking-engine loaded without API',
            loadError: 'No se pudo cargar chat-booking-engine.js',
            logLabel: 'Chat booking engine',
        });
    }

    function initChatBookingEngineWarmup() {
        const warmup = createWarmupRunner(() => loadChatBookingEngine());
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
        bindWarmupTarget(
            '#quickOptions [data-action="quick-message"][data-value="appointment"]',
            'mouseenter',
            warmup
        );
        bindWarmupTarget(
            '#quickOptions [data-action="quick-message"][data-value="appointment"]',
            'touchstart',
            warmup
        );
        bindWarmupTarget('#chatInput', 'focus', warmup, false);
        scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1700 });
    }

    function startChatBooking() {
        runDeferredModule(
            loadChatBookingEngine,
            (engine) => engine.startChatBooking(),
            () => {
                addBotMessage(
                    'No pude iniciar la reserva por chat. Puedes continuar desde <a href="#citas" data-action="minimize-chat">el formulario</a>.'
                );
            }
        );
    }

    function handleChatBookingSelection(value) {
        runDeferredModule(
            loadChatBookingEngine,
            (engine) => engine.handleChatBookingSelection(value),
            () => {
                addBotMessage('No pude procesar esa opcion. Intenta nuevamente.');
            }
        );
    }

    function handleChatDateSelect(value) {
        if (!value) return;
        runDeferredModule(
            loadChatBookingEngine,
            (engine) => engine.handleChatDateSelect(value),
            () => {
                addBotMessage('No pude procesar esa fecha. Intenta nuevamente.');
            }
        );
    }

    function processChatBookingStep(userInput) {
        return withDeferredModule(loadChatBookingEngine, (engine) =>
            engine.processChatBookingStep(userInput)
        );
    }

    function isChatBookingActive() {
        if (
            window.Piel &&
            window.Piel.ChatBookingEngine &&
            typeof window.Piel.ChatBookingEngine.isActive === 'function'
        ) {
            return window.Piel.ChatBookingEngine.isActive();
        }
        return false;
    }

    function loadFigoChatEngine() {
        return loadDeferredModule({
            cacheKey: 'figo-chat-engine',
            src: FIGO_CHAT_ENGINE_URL,
            scriptDataAttribute: 'data-figo-chat-engine',
            resolveModule: () => window.Piel && window.Piel.FigoChatEngine,
            isModuleReady: (module) => !!(module && typeof module.processWithKimi === 'function'),
            onModuleReady: (module) => {
                if (module && typeof module.init === 'function') {
                    module.init({
                        debugLog,
                        showTypingIndicator,
                        removeTypingIndicator,
                        addBotMessage,
                        startChatBooking,
                        processChatBookingStep,
                        isChatBookingActive,
                        showToast,
                        getConversationContext,
                        setConversationContext,
                        getCurrentAppointment,
                        getChatHistory,
                        setChatHistory,
                        chatContextMaxItems: CHAT_CONTEXT_MAX_ITEMS,
                        clinicAddress: CLINIC_ADDRESS,
                        clinicMapUrl: CLINIC_MAP_URL,
                        doctorCarolinaPhone: DOCTOR_CAROLINA_PHONE,
                        doctorCarolinaEmail: DOCTOR_CAROLINA_EMAIL
                    });
                }
            },
            missingApiError: 'Figo chat engine loaded without API',
            loadError: 'No se pudo cargar chat-engine.js',
        });
    }

    function initChatEngineWarmup() {
        const warmup = createWarmupRunner(() => loadFigoChatEngine(), {
            markWarmOnSuccess: true,
        });
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
        bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
        bindWarmupTarget('#chatInput', 'focus', warmup);
        scheduleDeferredTask(warmup, { idleTimeout: 7000, fallbackDelay: 7000 });
    }

    async function processWithKimi(message) {
        return runDeferredModule(
            loadFigoChatEngine,
            (engine) => engine.processWithKimi(message),
            (error) => {
                removeTypingIndicator();
                addBotMessage(
                    'No se pudo iniciar el asistente en este momento. Intenta de nuevo o escribenos por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">+593 98 245 3672</a>.',
                    false
                );
            }
        );
    }

    function checkServerEnvironment() {
        if (window.location.protocol === 'file:') {
            setTimeout(() => {
                showToast(
                    'Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md',
                    'warning',
                    'Servidor requerido'
                );
            }, 2000);
            return false;
        }
        return true;
    }

    const DATA_BUNDLE_URL = withDeployAssetVersion(
        '/js/engines/data-bundle.js?v=20260221-api-fix'
    );

    function selectService(value) {
        const select = document.getElementById('serviceSelect');
        if (select) {
            select.value = value;
            select.dispatchEvent(new Event('change'));
            markBookingViewed('service_select');
            const appointmentSection = document.getElementById('citas');
            if (appointmentSection) {
                const navHeight =
                    document.querySelector('.nav')?.offsetHeight || 80;
                const targetPosition =
                    appointmentSection.offsetTop - navHeight - 20;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth',
                });
            }
        }
    }

    function getActionRouterEngineDeps() {
        return {
            setThemeMode,
            changeLanguage,
            toggleMobileMenu,
            startWebVideo,
            openReviewModal,
            closeReviewModal,
            closeVideoModal,
            closePaymentModal,
            processPayment,
            closeSuccessModal,
            closeRescheduleModal,
            submitReschedule,
            toggleChatbot,
            sendChatMessage,
            handleChatBookingSelection,
            sendQuickMessage,
            minimizeChatbot,
            startChatBooking,
            handleChatDateSelect,
            selectService,
        };
    }

    function loadActionRouterEngine() {
        return loadDeferredModule({
            cacheKey: 'action-router-engine',
            src: DATA_BUNDLE_URL,
            scriptDataAttribute: 'data-data-bundle',
            resolveModule: () =>
                (window.Piel && window.Piel.ActionRouterEngine) ||
                window.PielActionRouterEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getActionRouterEngineDeps()),
            missingApiError: 'action-router-engine loaded without API',
            loadError: 'No se pudo cargar action-router-engine.js',
            logLabel: 'Action router engine',
        });
    }

    function initActionRouterEngine() {
        runDeferredModule(
            loadActionRouterEngine,
            () => undefined,
            (error) => {
            }
        );
    }

    const UI_BUNDLE_URL = withDeployAssetVersion(
        '/js/engines/ui-bundle.js?v=20260220-consolidated1'
    );

    function getConsentEngineDeps() {
        return {
            getCurrentLang: () => state.currentLang,
            showToast,
            trackEvent,
            cookieConsentKey: COOKIE_CONSENT_KEY,
            gaMeasurementId: 'G-GYY8PE5M8W',
        };
    }

    function loadConsentEngine() {
        return loadDeferredModule({
            cacheKey: 'consent-engine',
            src: UI_BUNDLE_URL,
            scriptDataAttribute: 'data-ui-bundle',
            resolveModule: () => window.Piel && window.Piel.ConsentEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getConsentEngineDeps()),
            missingApiError: 'consent-engine loaded without API',
            loadError: 'No se pudo cargar consent-engine.js',
            logLabel: 'Consent engine',
        });
    }

    function initGA4() {
        runDeferredModule(loadConsentEngine, (engine) => engine.initGA4());
    }

    function bootstrapConsent() {
        loadConsentEngine(); // Loads bundle and binds delegated listeners via init()
    }

    function showConsentBanner() {
        runDeferredModule(loadConsentEngine, (engine) => engine.initCookieBanner()); // Only shows banner
    }

    const GALLERY_INTERACTIONS_URL = withDeployAssetVersion(
        '/js/engines/gallery-interactions.js?v=figo-gallery-20260218-phase4'
    );

    function loadGalleryInteractions() {
        return loadDeferredModule({
            cacheKey: 'gallery-interactions',
            src: GALLERY_INTERACTIONS_URL,
            scriptDataAttribute: 'data-gallery-interactions',
            resolveModule: () => window.Piel && window.Piel.GalleryInteractions,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(),
            missingApiError: 'gallery-interactions loaded without API',
            loadError: 'No se pudo cargar gallery-interactions.js',
            logLabel: 'Gallery interactions',
        });
    }

    function initGalleryInteractionsWarmup() {
        const warmup = createWarmupRunner(() => loadGalleryInteractions());
        const gallerySection = document.getElementById('galeria');
        observeOnceWhenVisible(gallerySection, warmup, {
            threshold: 0.05,
            rootMargin: '320px 0px',
            onNoObserver: warmup,
        });
        const firstFilterBtn = document.querySelector('.filter-btn');
        if (firstFilterBtn) {
            firstFilterBtn.addEventListener('mouseenter', warmup, {
                once: true,
                passive: true,
            });
            firstFilterBtn.addEventListener('touchstart', warmup, {
                once: true,
                passive: true,
            });
        }
        if (!gallerySection && !firstFilterBtn) {
            return;
        }
        scheduleDeferredTask(warmup, { idleTimeout: 2500, fallbackDelay: 1500 });
    }

    const CONTENT_JSON_URL = withDeployAssetVersion('/content/index.json');
    const REQUIRED_SECTION_IDS = [
        'showcase',
        'servicios',
        'telemedicina',
        'tarifario',
        'equipo',
        'galeria',
        'consultorio',
        'resenas',
        'citas',
        'chatbotWidget',
    ];

    const FALLBACK_SECTION_TITLES = {
        showcase: 'Presentacion',
        servicios: 'Servicios',
        telemedicina: 'Telemedicina',
        tarifario: 'Tarifario',
        equipo: 'Equipo medico',
        galeria: 'Resultados',
        consultorio: 'Consultorio',
        resenas: 'Resenas',
        citas: 'Reserva de cita',
        chatbotWidget: 'Asistente virtual',
    };

    function hydrateDeferredText(container) {
        if (!window.PIEL_CONTENT) return;
        const nodes = container.querySelectorAll('[data-i18n]');
        nodes.forEach((node) => {
            const key = node.getAttribute('data-i18n');
            if (window.PIEL_CONTENT[key]) {
                if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                    node.placeholder = window.PIEL_CONTENT[key];
                } else {
                    node.innerHTML = window.PIEL_CONTENT[key];
                }
            }
        });
    }

    function normalizeDeferredAssetPath(value) {
        const raw = String(value || '').trim();
        if (!raw) return raw;
        if (raw.startsWith('images/')) return `/${raw}`;
        if (raw.startsWith('./images/')) return raw.replace('./images/', '/images/');
        return raw;
    }

    function normalizeDeferredSrcset(value) {
        const raw = String(value || '').trim();
        if (!raw) return raw;
        return raw
            .split(',')
            .map((chunk) => {
                const trimmed = chunk.trim();
                if (!trimmed) return trimmed;
                const parts = trimmed.split(/\s+/);
                parts[0] = normalizeDeferredAssetPath(parts[0]);
                return parts.join(' ');
            })
            .join(', ');
    }

    function normalizeDeferredInlineStyle(value) {
        const raw = String(value || '');
        if (!raw) return raw;
        return raw
            .replace(/url\((['"]?)\.?\/?images\//g, "url($1/images/")
            .replace(/url\((['"]?)images\//g, "url($1/images/");
    }

    function normalizeDeferredAssetUrls(container) {
        if (!container) return;

        container.querySelectorAll('[src]').forEach((node) => {
            const current = node.getAttribute('src');
            const next = normalizeDeferredAssetPath(current);
            if (next && next !== current) {
                node.setAttribute('src', next);
            }
        });

        container.querySelectorAll('[data-src]').forEach((node) => {
            const current = node.getAttribute('data-src');
            const next = normalizeDeferredAssetPath(current);
            if (next && next !== current) {
                node.setAttribute('data-src', next);
            }
        });

        container.querySelectorAll('[srcset]').forEach((node) => {
            const current = node.getAttribute('srcset');
            const next = normalizeDeferredSrcset(current);
            if (next && next !== current) {
                node.setAttribute('srcset', next);
            }
        });

        container.querySelectorAll('[data-srcset]').forEach((node) => {
            const current = node.getAttribute('data-srcset');
            const next = normalizeDeferredSrcset(current);
            if (next && next !== current) {
                node.setAttribute('data-srcset', next);
            }
        });

        container.querySelectorAll('[style*="url("]').forEach((node) => {
            const current = node.getAttribute('style');
            const next = normalizeDeferredInlineStyle(current);
            if (next && next !== current) {
                node.setAttribute('style', next);
            }
        });
    }

    function forceDeferredSectionPaint(container) {
        if (!container || !(container instanceof HTMLElement)) return;
        container.style.contentVisibility = 'visible';
        container.style.containIntrinsicSize = 'auto';
    }

    function isValidDeferredPayload(data) {
        if (!data || typeof data !== 'object') return false;
        return REQUIRED_SECTION_IDS.some(
            (id) => typeof data[id] === 'string' && data[id].trim() !== ''
        );
    }

    async function tryFetchDeferredPayload(url, useCacheBuster = false) {
        const parsedUrl = new URL(url, window.location.origin);
        if (useCacheBuster) {
            parsedUrl.searchParams.set('_ts', String(Date.now()));
        }

        const response = await fetch(parsedUrl.toString(), {
            cache: 'no-store',
            credentials: 'same-origin',
        });
        if (!response.ok) {
            throw new Error(`Deferred content fetch failed (${response.status})`);
        }

        const data = await response.json();
        if (!isValidDeferredPayload(data)) {
            throw new Error('Deferred content payload is invalid');
        }

        return data;
    }

    async function fetchDeferredPayload() {
        const candidateUrls = [
            CONTENT_JSON_URL,
            '/content/index.json',
            'content/index.json',
            './content/index.json',
        ];
        const uniqueUrls = [...new Set(candidateUrls.filter(Boolean))];

        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const useCacheBuster = attempt > 0;
            for (const url of uniqueUrls) {
                try {
                    return await tryFetchDeferredPayload(url, useCacheBuster);
                } catch (error) {
                    lastError = error;
                }
            }
        }

        throw lastError || new Error('Deferred content unavailable');
    }

    function renderDeferredFallbackState() {
        const refreshHref = encodeURI(window.location.pathname || '/');
        document.querySelectorAll('.section.deferred-content').forEach((section) => {
            const title =
                FALLBACK_SECTION_TITLES[section.id] || 'Contenido temporalmente no disponible';
            section.innerHTML = `
            <div class="section-header" style="text-align:center;">
                <h2 class="section-title">${title}</h2>
                <p class="section-subtitle">
                    Estamos recargando esta seccion. Si no aparece en unos segundos, recarga la pagina.
                </p>
                <a href="${refreshHref}" class="btn btn-secondary">
                    Recargar ahora
                </a>
            </div>
        `;
            section.classList.remove('deferred-content');
            forceDeferredSectionPaint(section);
        });
    }

    async function loadDeferredContent() {
        try {
            const data = await fetchDeferredPayload();

            Object.keys(data).forEach((id) => {
                const container = document.getElementById(id);
                if (container && container.classList.contains('deferred-content')) {
                    container.innerHTML = data[id];
                    normalizeDeferredAssetUrls(container);
                    container.classList.remove('deferred-content'); // Optional cleanup
                    forceDeferredSectionPaint(container);
                    hydrateDeferredText(container);
                } else if (!container) {
                    debugLog(`Warning: Container #${id} not found for deferred content.`);
                }
            });

            debugLog('Deferred content loaded and hydrated.');
            return true;
        } catch (error) {
            renderDeferredFallbackState();
            return false;
        }
    }

    // Setup global version
    window.Piel = window.Piel || {};
    window.Piel.deployVersion =
        window.Piel.deployVersion || resolveDeployAssetVersion();

    // Deferred Stylesheet
    const DEFERRED_STYLESHEET_URL = withDeployAssetVersion(
        '/styles-deferred.css?v=ui-20260221-deferred18-fullcssfix1'
    );
    let deferredStylesheetPromise = null;
    let deferredStylesheetInitDone = false;

    function loadDeferredStylesheet() {
        if (
            document.querySelector(
                'link[data-deferred-stylesheet="true"], link[rel="stylesheet"][href*="styles-deferred.css"]'
            )
        ) {
            return Promise.resolve(true);
        }
        if (deferredStylesheetPromise) {
            return deferredStylesheetPromise;
        }
        deferredStylesheetPromise = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = DEFERRED_STYLESHEET_URL;
            link.dataset.deferredStylesheet = 'true';
            link.onload = () => resolve(true);
            link.onerror = () =>
                reject(new Error('No se pudo cargar styles-deferred.css'));
            document.head.appendChild(link);
        }).catch((error) => {
            deferredStylesheetPromise = null;
            throw error;
        });
        return deferredStylesheetPromise;
    }

    function initDeferredStylesheetLoading() {
        if (deferredStylesheetInitDone || window.location.protocol === 'file:') {
            return;
        }
        deferredStylesheetInitDone = true;
        const startLoad = () => {
            loadDeferredStylesheet().catch(() => undefined);
        };
        scheduleDeferredTask(startLoad, {
            idleTimeout: 1200,
            fallbackDelay: 160,
            skipOnConstrained: false,
            constrainedDelay: 900,
        });
    }

    function disablePlaceholderExternalLinks() {
        document.querySelectorAll('a[href^="URL_"]').forEach((anchor) => {
            anchor.removeAttribute('href');
            anchor.setAttribute('aria-disabled', 'true');
            anchor.classList.add('is-disabled-link');
        });
    }

    function resolveWhatsappSource(waLink) {
        if (!waLink || !(waLink instanceof Element)) return 'unknown';

        const chatContext = waLink.closest('#chatbotContainer, #chatbotWidget');
        if (chatContext) return 'chatbot';

        const section = waLink.closest(
            'section[id], footer[id], footer, .quick-contact-dock'
        );
        if (!section) return 'unknown';

        const sectionId = section.getAttribute('id') || '';
        if (sectionId) return sectionId;
        if (section.classList.contains('quick-contact-dock')) return 'quick_dock';
        if (section.tagName && section.tagName.toLowerCase() === 'footer')
            return 'footer';
        return 'unknown';
    }

    function initBookingCalendarLazyInit() {
        function wireBookingCalendarLazyLoad(element) {
            if (!element) {
                return;
            }

            element.addEventListener('click', function () {
                const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');
                loadDeferredModule({
                    cacheKey: 'booking-utils-calendar',
                    src: BOOKING_UTILS_URL,
                    scriptDataAttribute: 'data-booking-utils',
                    resolveModule: () => window.PielBookingCalendarEngine
                }).then(function (moduleRef) {
                    if (moduleRef && typeof moduleRef.initCalendar === 'function') {
                        moduleRef.initCalendar();
                    }
                }).catch(function () {
                    // noop
                });
            });
        }

        const bookingBtn = document.getElementById('booking-btn');
        wireBookingCalendarLazyLoad(bookingBtn);

        document.querySelectorAll('a[href="#citas"]').forEach(function (button) {
            if (button.id !== 'booking-btn') {
                wireBookingCalendarLazyLoad(button);
            }
        });
    }

    function fallbackSelectService(value) {
        const select = document.getElementById('serviceSelect');
        if (select) {
            select.value = value;
            select.dispatchEvent(new Event('change'));
            markBookingViewed('service_select');
            const appointmentSection = document.getElementById('citas');
            if (appointmentSection) {
                const navHeight = document.querySelector('.nav')?.offsetHeight || 80;
                const targetPosition = appointmentSection.offsetTop - navHeight - 20;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth',
                });
            }
        }
    }

    let chatActionFallbackBridgeBound = false;
    function initChatActionFallbackBridge() {
        if (chatActionFallbackBridgeBound) {
            return;
        }
        chatActionFallbackBridgeBound = true;

        document.addEventListener('click', function (event) {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            const actionEl = target.closest('[data-action]');
            if (!actionEl) return;

            const action = String(actionEl.getAttribute('data-action') || '').trim();
            const value = actionEl.getAttribute('data-value') || '';

            switch (action) {
                case 'toggle-chatbot':
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    toggleChatbot();
                    break;
                case 'minimize-chat':
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    minimizeChatbot();
                    break;
                case 'send-chat-message':
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    sendChatMessage();
                    break;
                case 'quick-message':
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    sendQuickMessage(value);
                    break;
                case 'chat-booking':
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    handleChatBookingSelection(value);
                    break;
                case 'start-booking':
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    startChatBooking();
                    break;
                case 'select-service':
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    fallbackSelectService(value);
                    break;
            }
        });

        document.addEventListener('change', function (event) {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.closest('[data-action="chat-date-select"]')) {
                handleChatDateSelect(target.value);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        disablePlaceholderExternalLinks();
        bootstrapConsent();
        initChatActionFallbackBridge();
        initActionRouterEngine();
        initDeferredStylesheetLoading();
        initThemeMode();
        changeLanguage(state.currentLang);
        initGA4();
        initBookingFunnelObserver();
        initDeferredSectionPrefetch();

        loadDeferredContent().then(() => {
            showConsentBanner();

            const initHighPriorityWarmups = createOnceTask(() => {
                initEnglishBundleWarmup();
                initDataEngineWarmup();
                initBookingEngineWarmup();
                initBookingUiWarmup();
                initChatUiEngineWarmup();
                initChatWidgetEngineWarmup();
            });

            const initLowPriorityWarmups = createOnceTask(() => {
                initReviewsEngineWarmup();
                initGalleryInteractionsWarmup();
                initChatEngineWarmup();
                initChatBookingEngineWarmup();
                initUiEffectsWarmup();
                initRescheduleEngineWarmup();
                initSuccessModalEngineWarmup();
                initEngagementFormsEngineWarmup();
                initModalUxEngineWarmup();
            });

            const initDeferredWarmups = createOnceTask(() => {
                initHighPriorityWarmups();
                initLowPriorityWarmups();
                initBookingUiWarmup();
            });

            window.addEventListener('pointerdown', initDeferredWarmups, {
                once: true,
                passive: true,
            });
            window.addEventListener('keydown', initDeferredWarmups, { once: true });

            scheduleDeferredTask(initHighPriorityWarmups, {
                idleTimeout: 1400,
                fallbackDelay: 500,
                skipOnConstrained: false,
                constrainedDelay: 900,
            });

            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.addEventListener('keypress', handleChatKeypress);
            }

            // Gallery lazy load is already initialized below in the legacy fallback block.
            initBookingCalendarLazyInit();
        });

        window.addEventListener('pagehide', () => {
            maybeTrackCheckoutAbandon$1('page_hide');
        });

        checkServerEnvironment();

        // Smooth Scroll
        const nav = document.querySelector('.nav');
        document.addEventListener('click', function (e) {
            const targetEl = e.target instanceof Element ? e.target : null;
            if (!targetEl) return;

            const anchor = targetEl.closest('a[href^="#"]');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href || href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();
            const navHeight = nav ? nav.offsetHeight : 0;
            const targetPosition = target.offsetTop - navHeight - 20;

            if (href === '#citas') {
                markBookingViewed('cta_click');
            }

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth',
            });
        });

        // WhatsApp Analytics
        document.addEventListener('click', function (e) {
            const targetEl = e.target instanceof Element ? e.target : null;
            if (!targetEl) return;

            const waLink = targetEl.closest(
                'a[href*="wa.me"], a[href*="api.whatsapp.com"]'
            );
            if (!waLink) return;

            const source = resolveWhatsappSource(waLink);
            trackEvent('whatsapp_click', { source });

            const inChatContext =
                !!waLink.closest('#chatbotContainer') ||
                !!waLink.closest('#chatbotWidget');
            if (!inChatContext) return;

            trackEvent('chat_handoff_whatsapp', {
                source,
            });
        });
    });

    // Legacy: Gallery Lazy Loading
    (function() {
        const galleryObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    const srcset = img.dataset.srcset;

                    if (srcset) img.srcset = srcset;
                    img.src = src;
                    img.classList.add('loaded');

                    galleryObserver.unobserve(img);
                }
            });
        }, { rootMargin: '200px' });

        document.querySelectorAll('.gallery-img[data-src]').forEach(img => {
            galleryObserver.observe(img);
        });
    })();

    // Offline/Online Sync
    window.addEventListener('online', () => {
        // Refresh availability when connection returns
        initBookingEngineWarmup();
        initDataEngineWarmup();
    });

    // Push Notifications (Stub)
    window.subscribeToPushNotifications = async function() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }
        try {
            const registration = await navigator.serviceWorker.ready;
            // VAPID public key required here
            const publicVapidKey = 'B...';
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicVapidKey
            });
        } catch (error) {
        }
    };

    // Booking Calendar Lazy Init
    (function () {

        function wireBookingCalendarLazyLoad(element) {
            if (!element) {
                return;
            }

            element.addEventListener('click', function () {
                const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');
                loadDeferredModule({
                    cacheKey: 'booking-utils-calendar',
                    src: BOOKING_UTILS_URL,
                    scriptDataAttribute: 'data-booking-utils',
                    resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine
                }).then(function (moduleRef) {
                    if (moduleRef && typeof moduleRef.initCalendar === 'function') {
                        moduleRef.initCalendar();
                    }
                }).catch(function () {
                    // noop
                });
            });
        }

        const bookingBtn = document.getElementById('booking-btn');
        wireBookingCalendarLazyLoad(bookingBtn);

        document.querySelectorAll('a[href="#citas"]').forEach(function (button) {
            if (button.id !== 'booking-btn') {
                wireBookingCalendarLazyLoad(button);
            }
        });
    })();

})();
