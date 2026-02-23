/**
 * Bootstrap runtime helpers extracted from inline script.
 * Keeps CSP strict by avoiding executable inline scripts.
 */
(function () {
    'use strict';

    const DEFERRED_STYLESHEET_URL =
        '/styles-deferred.css?v=ui-20260223-clsfix1';

    const deferredModulePromises = new Map();
    let deferredStylesheetPromise = null;
    let deferredStylesheetInitDone = false;

    function debugLog() {
        // Debug logging removed
    }

    function loadDeferredModule(options) {
        const safeOptions = options || {};
        const cacheKey = safeOptions.cacheKey;
        const src = safeOptions.src;
        const scriptDataAttribute = safeOptions.scriptDataAttribute;
        const resolveModule = safeOptions.resolveModule;
        const isModuleReady =
            typeof safeOptions.isModuleReady === 'function'
                ? safeOptions.isModuleReady
                : function (moduleRef) {
                      return !!moduleRef;
                  };
        const onModuleReady = safeOptions.onModuleReady;
        const missingApiError = safeOptions.missingApiError;
        const loadError = safeOptions.loadError;
        const logLabel = safeOptions.logLabel;

        if (
            !cacheKey ||
            !src ||
            !scriptDataAttribute ||
            typeof resolveModule !== 'function'
        ) {
            return Promise.reject(new Error('Invalid config'));
        }

        function getReady() {
            const moduleRef = resolveModule();
            if (isModuleReady(moduleRef)) {
                if (typeof onModuleReady === 'function') {
                    onModuleReady(moduleRef);
                }
                return moduleRef;
            }
            return null;
        }

        const ready = getReady();
        if (ready) {
            return Promise.resolve(ready);
        }

        if (deferredModulePromises.has(cacheKey)) {
            return deferredModulePromises.get(cacheKey);
        }

        const modulePromise = new Promise(function (resolve, reject) {
            function handleLoad() {
                const moduleRef = getReady();
                if (moduleRef) {
                    resolve(moduleRef);
                    return;
                }
                reject(new Error(missingApiError || 'Module missing'));
            }

            const existingScript = document.querySelector(
                'script[' + scriptDataAttribute + '="true"]'
            );
            if (existingScript) {
                existingScript.addEventListener('load', handleLoad, {
                    once: true,
                });
                existingScript.addEventListener(
                    'error',
                    function () {
                        reject(new Error(loadError || 'Load failed'));
                    },
                    { once: true }
                );
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.setAttribute(scriptDataAttribute, 'true');
            script.onload = handleLoad;
            script.onerror = function () {
                reject(new Error(loadError || 'Load failed'));
            };
            document.head.appendChild(script);
        }).catch(function (error) {
            deferredModulePromises.delete(cacheKey);
            if (logLabel) {
                debugLog(logLabel + ' failed:', error);
            }
            throw error;
        });

        deferredModulePromises.set(cacheKey, modulePromise);
        return modulePromise;
    }

    function isConstrainedNetworkConnection() {
        const connection =
            navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;
        if (!connection) {
            return false;
        }

        const effectiveType = String(connection.effectiveType || '');
        return (
            connection.saveData === true || /(^|[^0-9])2g/.test(effectiveType)
        );
    }

    function scheduleDeferredTask(task, options) {
        const safeOptions = options || {};
        const idleTimeout =
            typeof safeOptions.idleTimeout === 'number'
                ? safeOptions.idleTimeout
                : 2000;
        const fallbackDelay =
            typeof safeOptions.fallbackDelay === 'number'
                ? safeOptions.fallbackDelay
                : 1200;
        const skipOnConstrained = safeOptions.skipOnConstrained !== false;
        const constrainedDelay =
            typeof safeOptions.constrainedDelay === 'number'
                ? safeOptions.constrainedDelay
                : fallbackDelay;

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

    function bindWarmupTarget(selector, eventName, handler, passive) {
        const element = document.querySelector(selector);
        if (!element) {
            return false;
        }

        element.addEventListener(eventName, handler, {
            once: true,
            passive: passive !== false,
        });

        return true;
    }

    function createOnceTask(task) {
        let executed = false;
        return function onceTask() {
            if (executed) {
                return;
            }
            executed = true;
            task();
        };
    }

    function createWarmupRunner(loadFn, options) {
        const safeOptions = options || {};
        const markWarmOnSuccess = safeOptions.markWarmOnSuccess === true;
        let warmed = false;

        return function warmupRunner() {
            if (warmed || window.location.protocol === 'file:') {
                return;
            }

            if (markWarmOnSuccess) {
                Promise.resolve(loadFn())
                    .then(function () {
                        warmed = true;
                    })
                    .catch(function () {
                        // noop
                    });
                return;
            }

            warmed = true;
            Promise.resolve(loadFn()).catch(function () {
                warmed = false;
            });
        };
    }

    function observeOnceWhenVisible(element, onVisible, options) {
        const safeOptions = options || {};
        const threshold =
            typeof safeOptions.threshold === 'number'
                ? safeOptions.threshold
                : 0.05;
        const rootMargin =
            typeof safeOptions.rootMargin === 'string'
                ? safeOptions.rootMargin
                : '0px';
        const onNoObserver = safeOptions.onNoObserver;

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
            function (entries) {
                entries.forEach(function (entry) {
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
            .then(function () {
                return loader();
            })
            .then(function (moduleRef) {
                return onReady(moduleRef);
            });
    }

    function runDeferredModule(loader, onReady, onError) {
        return withDeferredModule(loader, onReady).catch(function (error) {
            if (typeof onError === 'function') {
                return onError(error);
            }
            return undefined;
        });
    }

    function resolveDeferredStylesheetUrl() {
        const preload = document.querySelector(
            'link[rel="preload"][as="style"][href*="styles-deferred.css"]'
        );
        if (preload) {
            const href = preload.getAttribute('href');
            if (href && href.trim() !== '') {
                return href;
            }
        }
        return DEFERRED_STYLESHEET_URL;
    }

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

        const stylesheetUrl = resolveDeferredStylesheetUrl();
        deferredStylesheetPromise = new Promise(function (resolve, reject) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = stylesheetUrl;
            link.dataset.deferredStylesheet = 'true';
            link.onload = function () {
                resolve(true);
            };
            link.onerror = function () {
                reject(new Error('Style load failed'));
            };
            document.head.appendChild(link);
        }).catch(function (error) {
            deferredStylesheetPromise = null;
            debugLog('CSS fail', error);
            throw error;
        });

        return deferredStylesheetPromise;
    }

    function initDeferredStylesheetLoading() {
        if (
            deferredStylesheetInitDone ||
            window.location.protocol === 'file:'
        ) {
            return;
        }

        deferredStylesheetInitDone = true;
        scheduleDeferredTask(
            function () {
                loadDeferredStylesheet().catch(function () {
                    // noop
                });
            },
            {
                idleTimeout: 1200,
                fallbackDelay: 160,
                skipOnConstrained: false,
                constrainedDelay: 900,
            }
        );
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker
                .register('/sw.js', { updateViaCache: 'none' })
                .catch(function (error) {
                    debugLog('SW fail', error);
                });
        });
    }

    window.debugLog = debugLog;
    window.loadDeferredModule = loadDeferredModule;
    window.isConstrainedNetworkConnection = isConstrainedNetworkConnection;
    window.scheduleDeferredTask = scheduleDeferredTask;
    window.bindWarmupTarget = bindWarmupTarget;
    window.createOnceTask = createOnceTask;
    window.createWarmupRunner = createWarmupRunner;
    window.observeOnceWhenVisible = observeOnceWhenVisible;
    window.withDeferredModule = withDeferredModule;
    window.runDeferredModule = runDeferredModule;
    window.loadDeferredStylesheet = loadDeferredStylesheet;
    window.initDeferredStylesheetLoading = initDeferredStylesheetLoading;
})();
window.initDeferredStylesheetLoading();
